from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case

from app.database import get_db
from app.models import UtilityReading, Building, Alert, User, UtilityType, AlertType
from app.schemas import ReportData, BuildingRanking
from app.auth import get_current_active_user

router = APIRouter()

@router.get("/monthly", response_model=ReportData)
def generate_monthly_report(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    period_start = datetime(year, month, 1)
    if month == 12:
        period_end = datetime(year + 1, 1, 1)
    else:
        period_end = datetime(year, month + 1, 1)
    
    return _generate_report(db, period_start, period_end)

@router.get("/custom", response_model=ReportData)
def generate_custom_report(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return _generate_report(db, start_date, end_date)

def _generate_report(db: Session, start_date: datetime, end_date: datetime) -> ReportData:
    # Get total consumption
    water_total = db.query(func.sum(UtilityReading.value)).filter(
        and_(
            UtilityReading.utility_type == UtilityType.WATER,
            UtilityReading.reading_date >= start_date,
            UtilityReading.reading_date < end_date
        )
    ).scalar() or 0.0
    
    electricity_total = db.query(func.sum(UtilityReading.value)).filter(
        and_(
            UtilityReading.utility_type == UtilityType.ELECTRICITY,
            UtilityReading.reading_date >= start_date,
            UtilityReading.reading_date < end_date
        )
    ).scalar() or 0.0
    
    # Get building summaries (optimized single query)
    building_summaries_query = db.query(
        Building.id,
        Building.name,
        Building.code,
        func.sum(
            case(
                (UtilityReading.utility_type == UtilityType.WATER, UtilityReading.value),
                else_=0
            )
        ).label('water'),
        func.sum(
            case(
                (UtilityReading.utility_type == UtilityType.ELECTRICITY, UtilityReading.value),
                else_=0
            )
        ).label('electricity')
    ).outerjoin(
        UtilityReading,
        and_(
            Building.id == UtilityReading.building_id,
            UtilityReading.reading_date >= start_date,
            UtilityReading.reading_date < end_date
        )
    ).group_by(
        Building.id, Building.name, Building.code
    ).all()
    
    building_summaries = [
        {
            "building_id": bid,
            "building_name": name,
            "building_code": code,
            "water": water or 0.0,
            "electricity": electricity or 0.0
        }
        for bid, name, code, water, electricity in building_summaries_query
    ]
    
    # Get top consumers
    water_rankings = db.query(
        Building.id,
        Building.name,
        Building.code,
        func.sum(UtilityReading.value).label('total')
    ).join(
        UtilityReading, Building.id == UtilityReading.building_id
    ).filter(
        and_(
            UtilityReading.utility_type == UtilityType.WATER,
            UtilityReading.reading_date >= start_date,
            UtilityReading.reading_date < end_date
        )
    ).group_by(
        Building.id, Building.name, Building.code
    ).order_by(
        func.sum(UtilityReading.value).desc()
    ).limit(5).all()
    
    top_consumers = []
    for rank, (building_id, name, code, total) in enumerate(water_rankings, 1):
        top_consumers.append(BuildingRanking(
            building_id=building_id,
            building_name=name,
            building_code=code,
            total_consumption=total or 0.0,
            utility_type=UtilityType.WATER,
            rank=rank
        ))
    
    # Count alerts
    alerts_generated = db.query(func.count(Alert.id)).filter(
        and_(
            Alert.created_at >= start_date,
            Alert.created_at < end_date
        )
    ).scalar() or 0
    
    anomalies_detected = db.query(func.count(Alert.id)).filter(
        and_(
            Alert.created_at >= start_date,
            Alert.created_at < end_date,
            Alert.alert_type.in_([AlertType.SPIKE, AlertType.THRESHOLD_BREACH, AlertType.CONTINUOUS_HIGH])
        )
    ).scalar() or 0
    
    return ReportData(
        period_start=start_date,
        period_end=end_date,
        total_water=water_total,
        total_electricity=electricity_total,
        building_summaries=building_summaries,
        top_consumers=top_consumers,
        alerts_generated=alerts_generated,
        anomalies_detected=anomalies_detected
    )
