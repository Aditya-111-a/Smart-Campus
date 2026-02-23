from typing import List, Optional
from datetime import datetime, timedelta
import statistics

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models import UtilityReading, Building, User, UtilityType
from app.schemas import TotalConsumption, BuildingRanking, TimeSummary, AnalyticsStats, ZoneStat
from app.auth import get_current_active_user

router = APIRouter()

@router.get("/totals", response_model=TotalConsumption)
def get_totals(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    building_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(UtilityReading)
    
    if building_id:
        query = query.filter(UtilityReading.building_id == building_id)
    if start_date:
        query = query.filter(UtilityReading.reading_date >= start_date)
    if end_date:
        query = query.filter(UtilityReading.reading_date <= end_date)
    
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    water_total = (
        query.filter(UtilityReading.utility_type == UtilityType.WATER)
        .with_entities(func.sum(UtilityReading.value))
        .scalar()
        or 0.0
    )

    electricity_total = (
        query.filter(UtilityReading.utility_type == UtilityType.ELECTRICITY)
        .with_entities(func.sum(UtilityReading.value))
        .scalar()
        or 0.0
    )

    sample_size = query.count()

    return TotalConsumption(
        total_water=water_total,
        total_electricity=electricity_total,
        period_start=start_date,
        period_end=end_date,
        sample_size=sample_size,
        filters={
            "building_id": building_id,
        },
    )

@router.get("/rankings", response_model=List[BuildingRanking])
def get_rankings(
    utility_type: UtilityType = Query(...),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    # Get total consumption per building
    results = db.query(
        Building.id,
        Building.name,
        Building.code,
        func.sum(UtilityReading.value).label('total')
    ).join(
        UtilityReading, Building.id == UtilityReading.building_id
    ).filter(
        and_(
            UtilityReading.utility_type == utility_type,
            UtilityReading.reading_date >= start_date,
            UtilityReading.reading_date <= end_date
        )
    ).group_by(
        Building.id, Building.name, Building.code
    ).order_by(
        func.sum(UtilityReading.value).desc()
    ).limit(limit).all()
    
    rankings = []
    for rank, (building_id, name, code, total) in enumerate(results, 1):
        rankings.append(BuildingRanking(
            building_id=building_id,
            building_name=name,
            building_code=code,
            total_consumption=total or 0.0,
            utility_type=utility_type,
            rank=rank
        ))
    
    return rankings

@router.get("/summary", response_model=List[TimeSummary])
def get_summary(
    period: str = Query(..., pattern="^(daily|weekly|monthly)$"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not start_date:
        if period == "daily":
            start_date = datetime.utcnow() - timedelta(days=7)
        elif period == "weekly":
            start_date = datetime.utcnow() - timedelta(weeks=8)
        else:  # monthly
            start_date = datetime.utcnow() - timedelta(days=365)
    
    if not end_date:
        end_date = datetime.utcnow()
    
    query = db.query(UtilityReading).filter(
        and_(
            UtilityReading.reading_date >= start_date,
            UtilityReading.reading_date <= end_date
        )
    )
    
    summaries = []
    
    if period == "daily":
        # Group by day
        daily_data = {}
        for reading in query.all():
            date_key = reading.reading_date.date()
            if date_key not in daily_data:
                daily_data[date_key] = {"water": 0.0, "electricity": 0.0, "buildings": {}}
            
            daily_data[date_key][reading.utility_type.value] += reading.value
            
            building_id = reading.building_id
            if building_id not in daily_data[date_key]["buildings"]:
                daily_data[date_key]["buildings"][building_id] = {"water": 0.0, "electricity": 0.0}
            daily_data[date_key]["buildings"][building_id][reading.utility_type.value] += reading.value
        
        for date, data in sorted(daily_data.items()):
            building_breakdown = [
                {"building_id": bid, **values}
                for bid, values in data["buildings"].items()
            ]
            summaries.append(TimeSummary(
                period="daily",
                date=datetime.combine(date, datetime.min.time()),
                total_water=data["water"],
                total_electricity=data["electricity"],
                building_breakdown=building_breakdown
            ))
    
    elif period == "weekly":
        # Group by week
        weekly_data = {}
        for reading in query.all():
            week_start = reading.reading_date - timedelta(days=reading.reading_date.weekday())
            week_key = week_start.date()
            if week_key not in weekly_data:
                weekly_data[week_key] = {"water": 0.0, "electricity": 0.0, "buildings": {}}
            
            weekly_data[week_key][reading.utility_type.value] += reading.value
            
            building_id = reading.building_id
            if building_id not in weekly_data[week_key]["buildings"]:
                weekly_data[week_key]["buildings"][building_id] = {"water": 0.0, "electricity": 0.0}
            weekly_data[week_key]["buildings"][building_id][reading.utility_type.value] += reading.value
        
        for week_start, data in sorted(weekly_data.items()):
            building_breakdown = [
                {"building_id": bid, **values}
                for bid, values in data["buildings"].items()
            ]
            summaries.append(TimeSummary(
                period="weekly",
                date=datetime.combine(week_start, datetime.min.time()),
                total_water=data["water"],
                total_electricity=data["electricity"],
                building_breakdown=building_breakdown
            ))
    
    else:  # monthly
        # Group by month
        monthly_data = {}
        for reading in query.all():
            month_key = reading.reading_date.replace(day=1).date()
            if month_key not in monthly_data:
                monthly_data[month_key] = {"water": 0.0, "electricity": 0.0, "buildings": {}}
            
            monthly_data[month_key][reading.utility_type.value] += reading.value
            
            building_id = reading.building_id
            if building_id not in monthly_data[month_key]["buildings"]:
                monthly_data[month_key]["buildings"][building_id] = {"water": 0.0, "electricity": 0.0}
            monthly_data[month_key]["buildings"][building_id][reading.utility_type.value] += reading.value
        
        for month_start, data in sorted(monthly_data.items()):
            building_breakdown = [
                {"building_id": bid, **values}
                for bid, values in data["buildings"].items()
            ]
            summaries.append(TimeSummary(
                period="monthly",
                date=datetime.combine(month_start, datetime.min.time()),
                total_water=data["water"],
                total_electricity=data["electricity"],
                building_breakdown=building_breakdown
            ))
    
    return summaries


@router.get("/stats", response_model=AnalyticsStats)
def analytics_stats(
    utility_type: UtilityType = Query(...),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Compute basic descriptive statistics and per-zone totals for the given utility.
    """
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()

    readings = (
        db.query(UtilityReading)
        .join(Building, Building.id == UtilityReading.building_id)
        .filter(
            and_(
                UtilityReading.utility_type == utility_type,
                UtilityReading.reading_date >= start_date,
                UtilityReading.reading_date <= end_date,
            )
        )
        .all()
    )

    values = [r.value for r in readings]
    sample_size = len(values)

    if sample_size == 0:
        mean = median = variance = std_dev = 0.0
    else:
        mean = statistics.fmean(values)
        median = statistics.median(values)
        variance = statistics.pvariance(values) if sample_size > 1 else 0.0
        std_dev = statistics.pstdev(values) if sample_size > 1 else 0.0

    # Per-zone totals
    zone_rows = (
        db.query(
            Building.zone,
            func.sum(UtilityReading.value).label("total"),
            func.count(UtilityReading.id).label("count"),
        )
        .join(Building, Building.id == UtilityReading.building_id)
        .filter(
            and_(
                UtilityReading.utility_type == utility_type,
                UtilityReading.reading_date >= start_date,
                UtilityReading.reading_date <= end_date,
            )
        )
        .group_by(Building.zone)
        .all()
    )

    per_zone: List[ZoneStat] = [
        ZoneStat(
            zone=(zone.value if hasattr(zone, "value") else (zone or "unknown")),
            total=float(total or 0.0),
            sample_size=int(count or 0),
        )
        for zone, total, count in zone_rows
    ]

    return AnalyticsStats(
        utility_type=utility_type,
        start_date=start_date,
        end_date=end_date,
        sample_size=sample_size,
        mean=float(mean),
        median=float(median),
        variance=float(variance),
        std_dev=float(std_dev),
        per_zone=per_zone,
    )
