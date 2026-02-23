from collections import defaultdict
from typing import List, Optional
from datetime import datetime, timedelta
import statistics

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models import UtilityReading, Building, User, UtilityType, ZoneCategory
from app.schemas import (
    TotalConsumption,
    BuildingRanking,
    TimeSummary,
    AnalyticsStats,
    ZoneStat,
    AnalyticsInsights,
    AnalyticsAggregation,
    AnalyticsSeriesPoint,
)
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


@router.get("/insights", response_model=AnalyticsInsights)
def analytics_insights(
    utility_type: UtilityType = Query(...),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    zone: Optional[str] = Query(None),
    building_ids: Optional[str] = Query(None, description="Comma-separated building IDs"),
    moving_window: int = Query(7, ge=2, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()

    parsed_building_ids: Optional[List[int]] = None
    if building_ids:
        parsed_building_ids = []
        for token in building_ids.split(","):
            token = token.strip()
            if token:
                parsed_building_ids.append(int(token))

    query = (
        db.query(UtilityReading, Building)
        .join(Building, Building.id == UtilityReading.building_id)
        .filter(
            and_(
                UtilityReading.utility_type == utility_type,
                UtilityReading.reading_date >= start_date,
                UtilityReading.reading_date <= end_date,
            )
        )
    )

    if parsed_building_ids:
        query = query.filter(UtilityReading.building_id.in_(parsed_building_ids))
    zone_filter: Optional[ZoneCategory] = None
    if zone:
        try:
            zone_filter = ZoneCategory(zone)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid zone '{zone}'.",
            )
        query = query.filter(Building.zone == zone_filter)

    rows = query.order_by(UtilityReading.reading_date.asc()).all()
    values = [float(reading.value) for reading, _ in rows]
    sample_size = len(values)

    if sample_size == 0:
        mean = median = variance = std_dev = cumulative_sum = 0.0
    else:
        mean = float(statistics.fmean(values))
        median = float(statistics.median(values))
        variance = float(statistics.pvariance(values) if sample_size > 1 else 0.0)
        std_dev = float(statistics.pstdev(values) if sample_size > 1 else 0.0)
        cumulative_sum = float(sum(values))

    # Aggregations per building and zone
    by_building = defaultdict(lambda: {"label": "", "zone": "unknown", "values": [], "threshold_breaches": 0, "anomalies": 0})
    by_zone = defaultdict(lambda: {"label": "", "values": [], "threshold_breaches": 0, "anomalies": 0})

    cumulative_running = 0.0
    rolling_values: List[float] = []
    series: List[AnalyticsSeriesPoint] = []
    threshold_breaches = 0
    anomalies_detected = 0

    for reading, building in rows:
        zone_value = building.zone.value if hasattr(building.zone, "value") else (building.zone or "unknown")
        threshold = float(
            building.water_threshold if utility_type == UtilityType.WATER else building.electricity_threshold
        )
        value = float(reading.value)
        z_score = 0.0 if std_dev == 0 else (value - mean) / std_dev
        is_anomaly = abs(z_score) >= 2.5
        is_threshold_breach = value > threshold

        if is_anomaly:
            anomalies_detected += 1
        if is_threshold_breach:
            threshold_breaches += 1

        building_key = str(building.id)
        building_bucket = by_building[building_key]
        building_bucket["label"] = building.name
        building_bucket["zone"] = zone_value
        building_bucket["values"].append(value)
        if is_threshold_breach:
            building_bucket["threshold_breaches"] += 1
        if is_anomaly:
            building_bucket["anomalies"] += 1

        zone_bucket = by_zone[zone_value]
        zone_bucket["label"] = zone_value
        zone_bucket["values"].append(value)
        if is_threshold_breach:
            zone_bucket["threshold_breaches"] += 1
        if is_anomaly:
            zone_bucket["anomalies"] += 1

        cumulative_running += value
        rolling_values.append(value)
        if len(rolling_values) > moving_window:
            rolling_values.pop(0)
        moving_avg = float(sum(rolling_values) / len(rolling_values))

        series.append(
            AnalyticsSeriesPoint(
                date=reading.reading_date,
                value=value,
                moving_average=moving_avg,
                cumulative_sum=float(cumulative_running),
                z_score=float(z_score),
                is_anomaly=is_anomaly,
                building_id=building.id,
                building_name=building.name,
                zone=zone_value,
            )
        )

    per_building: List[AnalyticsAggregation] = []
    for key, bucket in by_building.items():
        vals = bucket["values"]
        total = float(sum(vals))
        per_building.append(
            AnalyticsAggregation(
                key=key,
                label=bucket["label"],
                total=total,
                sample_size=len(vals),
                mean=float(total / len(vals) if vals else 0.0),
                threshold_breaches=int(bucket["threshold_breaches"]),
                anomalies=int(bucket["anomalies"]),
            )
        )
    per_building.sort(key=lambda x: x.total, reverse=True)

    per_zone: List[AnalyticsAggregation] = []
    for key, bucket in by_zone.items():
        vals = bucket["values"]
        total = float(sum(vals))
        per_zone.append(
            AnalyticsAggregation(
                key=key,
                label=bucket["label"],
                total=total,
                sample_size=len(vals),
                mean=float(total / len(vals) if vals else 0.0),
                threshold_breaches=int(bucket["threshold_breaches"]),
                anomalies=int(bucket["anomalies"]),
            )
        )
    per_zone.sort(key=lambda x: x.total, reverse=True)

    return AnalyticsInsights(
        utility_type=utility_type,
        start_date=start_date,
        end_date=end_date,
        sample_size=sample_size,
        filters={
            "zone": zone_filter.value if zone_filter else None,
            "building_ids": parsed_building_ids or [],
        },
        mean=float(mean),
        median=float(median),
        variance=float(variance),
        std_dev=float(std_dev),
        cumulative_sum=float(cumulative_sum),
        moving_average_window=moving_window,
        threshold_breaches=int(threshold_breaches),
        anomalies_detected=int(anomalies_detected),
        per_building=per_building,
        per_zone=per_zone,
        series=series,
    )
