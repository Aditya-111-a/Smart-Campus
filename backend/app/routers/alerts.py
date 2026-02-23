from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.models import Alert, User, AlertStatus
from app.schemas import AlertResponse, AlertUpdate
from app.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=List[AlertResponse])
def list_alerts(
    status: Optional[AlertStatus] = Query(None),
    building_id: Optional[int] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Alert)
    
    if status:
        query = query.filter(Alert.status == status)
    if building_id:
        query = query.filter(Alert.building_id == building_id)
    
    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    
    # Add building names
    result = []
    for alert in alerts:
        alert_dict = AlertResponse.model_validate(alert).model_dump()
        alert_dict["building_name"] = alert.building.name
        result.append(AlertResponse(**alert_dict))
    
    return result

@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from fastapi import HTTPException
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert_dict = AlertResponse.model_validate(alert).model_dump()
    alert_dict["building_name"] = alert.building.name
    return AlertResponse(**alert_dict)

@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from fastapi import HTTPException
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if alert.status == AlertStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Cannot acknowledge a resolved alert")
    
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alert)
    
    alert_dict = AlertResponse.model_validate(alert).model_dump()
    alert_dict["building_name"] = alert.building.name
    return AlertResponse(**alert_dict)

@router.put("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from fastapi import HTTPException
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()
    if alert_update.resolution_notes:
        alert.resolution_notes = alert_update.resolution_notes
    
    db.commit()
    db.refresh(alert)
    
    alert_dict = AlertResponse.model_validate(alert).model_dump()
    alert_dict["building_name"] = alert.building.name
    return AlertResponse(**alert_dict)
