from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert, User, AlertStatus, AlertRule, Building
from app.schemas import AlertResponse, AlertUpdate, AlertRuleCreate, AlertRuleUpdate, AlertRuleResponse
from app.auth import get_current_active_user, get_current_admin_user

router = APIRouter()


@router.get('', response_model=List[AlertResponse])
def list_alerts(
    status: Optional[AlertStatus] = Query(None),
    building_id: Optional[int] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(Alert)

    if status:
        query = query.filter(Alert.status == status)
    if building_id:
        query = query.filter(Alert.building_id == building_id)

    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for alert in alerts:
        alert_dict = AlertResponse.model_validate(alert).model_dump()
        alert_dict['building_name'] = alert.building.name
        result.append(AlertResponse(**alert_dict))

    return result


@router.get('/rules', response_model=List[AlertRuleResponse])
def list_alert_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rules = db.query(AlertRule).order_by(AlertRule.created_at.desc()).all()
    return rules


@router.post('/rules', response_model=AlertRuleResponse, status_code=201)
def create_alert_rule(
    payload: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    from fastapi import HTTPException

    if payload.scope_type not in {'global', 'zone', 'building'}:
        raise HTTPException(status_code=422, detail='scope_type must be one of: global, zone, building')
    if payload.condition_type not in {'threshold', 'zscore', 'rate_of_change'}:
        raise HTTPException(status_code=422, detail='condition_type must be one of: threshold, zscore, rate_of_change')
    if payload.scope_type == 'building' and not payload.building_id:
        raise HTTPException(status_code=422, detail='building_id is required for building scope')
    if payload.scope_type == 'zone' and not payload.zone:
        raise HTTPException(status_code=422, detail='zone is required for zone scope')
    if payload.building_id:
        exists = db.query(Building).filter(Building.id == payload.building_id).first()
        if not exists:
            raise HTTPException(status_code=404, detail='Building not found')

    rule = AlertRule(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put('/rules/{rule_id}', response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    from fastapi import HTTPException

    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail='Alert rule not found')

    update_data = payload.model_dump(exclude_unset=True)
    if 'scope_type' in update_data and update_data['scope_type'] not in {'global', 'zone', 'building'}:
        raise HTTPException(status_code=422, detail='scope_type must be one of: global, zone, building')
    if 'condition_type' in update_data and update_data['condition_type'] not in {'threshold', 'zscore', 'rate_of_change'}:
        raise HTTPException(status_code=422, detail='condition_type must be one of: threshold, zscore, rate_of_change')
    if 'building_id' in update_data and update_data['building_id']:
        exists = db.query(Building).filter(Building.id == update_data['building_id']).first()
        if not exists:
            raise HTTPException(status_code=404, detail='Building not found')

    for field, value in update_data.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete('/rules/{rule_id}', status_code=204)
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    from fastapi import HTTPException

    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail='Alert rule not found')
    db.delete(rule)
    db.commit()
    return None


@router.get('/{alert_id}', response_model=AlertResponse)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from fastapi import HTTPException
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail='Alert not found')

    alert_dict = AlertResponse.model_validate(alert).model_dump()
    alert_dict['building_name'] = alert.building.name
    return AlertResponse(**alert_dict)


@router.put('/{alert_id}/acknowledge', response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from fastapi import HTTPException
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail='Alert not found')

    if alert.status == AlertStatus.RESOLVED:
        raise HTTPException(status_code=400, detail='Cannot acknowledge a resolved alert')

    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)

    alert_dict = AlertResponse.model_validate(alert).model_dump()
    alert_dict['building_name'] = alert.building.name
    return AlertResponse(**alert_dict)


@router.put('/{alert_id}/resolve', response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from fastapi import HTTPException
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail='Alert not found')

    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()
    if alert_update.resolution_notes:
        alert.resolution_notes = alert_update.resolution_notes

    db.commit()
    db.refresh(alert)

    alert_dict = AlertResponse.model_validate(alert).model_dump()
    alert_dict['building_name'] = alert.building.name
    return AlertResponse(**alert_dict)
