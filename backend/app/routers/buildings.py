from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Building, User, UtilityReading, UtilityType
from app.schemas import (
    BuildingCreate,
    BuildingUpdate,
    BuildingResponse,
    BuildingOverviewResponse,
    BuildingOverviewItem,
)
from app.auth import get_current_active_user, get_current_admin_user

router = APIRouter()


@router.get("", response_model=List[BuildingResponse])
def list_buildings(
    skip: int = 0,
    limit: int = 100,
    campus_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(Building)
    if campus_name:
        query = query.filter(Building.campus_name == campus_name)
    buildings = query.order_by(Building.name.asc()).offset(skip).limit(limit).all()
    return buildings


@router.get("/overview", response_model=BuildingOverviewResponse)
def building_overview(
    campus_name: Optional[str] = Query("VIT Vellore"),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    previous_end_date = start_date
    previous_start_date = previous_end_date - timedelta(days=days)

    buildings_query = db.query(Building)
    if campus_name:
        buildings_query = buildings_query.filter(Building.campus_name == campus_name)
    buildings = buildings_query.order_by(Building.name.asc()).all()

    if not buildings:
        return BuildingOverviewResponse(
            campus_name=campus_name or "VIT Vellore",
            start_date=start_date,
            end_date=end_date,
            previous_start_date=previous_start_date,
            previous_end_date=previous_end_date,
            sample_size=0,
            buildings=[],
        )

    building_ids = [b.id for b in buildings]

    current_rows = (
        db.query(
            UtilityReading.building_id.label("building_id"),
            func.sum(
                case((UtilityReading.utility_type == UtilityType.WATER, UtilityReading.value), else_=0.0)
            ).label("water"),
            func.sum(
                case((UtilityReading.utility_type == UtilityType.ELECTRICITY, UtilityReading.value), else_=0.0)
            ).label("electricity"),
            func.count(UtilityReading.id).label("sample_size"),
        )
        .filter(
            and_(
                UtilityReading.building_id.in_(building_ids),
                UtilityReading.reading_date >= start_date,
                UtilityReading.reading_date < end_date,
            )
        )
        .group_by(UtilityReading.building_id)
        .all()
    )

    previous_rows = (
        db.query(
            UtilityReading.building_id.label("building_id"),
            func.sum(
                case((UtilityReading.utility_type == UtilityType.WATER, UtilityReading.value), else_=0.0)
            ).label("water"),
            func.sum(
                case((UtilityReading.utility_type == UtilityType.ELECTRICITY, UtilityReading.value), else_=0.0)
            ).label("electricity"),
        )
        .filter(
            and_(
                UtilityReading.building_id.in_(building_ids),
                UtilityReading.reading_date >= previous_start_date,
                UtilityReading.reading_date < previous_end_date,
            )
        )
        .group_by(UtilityReading.building_id)
        .all()
    )

    current_map = {
        row.building_id: {
            "water": float(row.water or 0.0),
            "electricity": float(row.electricity or 0.0),
            "sample_size": int(row.sample_size or 0),
        }
        for row in current_rows
    }
    previous_map = {
        row.building_id: {
            "water": float(row.water or 0.0),
            "electricity": float(row.electricity or 0.0),
        }
        for row in previous_rows
    }

    def trend_pct(current: float, previous: float) -> float:
        if previous <= 0:
            return 0.0 if current <= 0 else 100.0
        return ((current - previous) / previous) * 100.0

    items: List[BuildingOverviewItem] = []
    total_sample_size = 0
    for building in buildings:
        current = current_map.get(building.id, {"water": 0.0, "electricity": 0.0, "sample_size": 0})
        previous = previous_map.get(building.id, {"water": 0.0, "electricity": 0.0})
        water_total = current["water"]
        electricity_total = current["electricity"]
        sample_size = current["sample_size"]
        total_sample_size += sample_size

        items.append(
            BuildingOverviewItem(
                id=building.id,
                name=building.name,
                code=building.code,
                description=building.description,
                campus_name=building.campus_name,
                zone=building.zone,
                tags=building.tags,
                is_24x7=bool(building.is_24x7),
                iot_enabled=bool(building.iot_enabled),
                water_threshold=float(building.water_threshold or 0.0),
                electricity_threshold=float(building.electricity_threshold or 0.0),
                water_total=water_total,
                electricity_total=electricity_total,
                total_consumption=water_total + electricity_total,
                water_trend_pct=trend_pct(water_total, previous["water"]),
                electricity_trend_pct=trend_pct(electricity_total, previous["electricity"]),
                sample_size=sample_size,
            )
        )

    return BuildingOverviewResponse(
        campus_name=campus_name or "VIT Vellore",
        start_date=start_date,
        end_date=end_date,
        previous_start_date=previous_start_date,
        previous_end_date=previous_end_date,
        sample_size=total_sample_size,
        buildings=items,
    )


@router.post("", response_model=BuildingResponse, status_code=status.HTTP_201_CREATED)
def create_building(
    building: BuildingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    # Normalise campus name
    campus_name = building.campus_name or "VIT Vellore"

    # Auto-generate a deterministic code if missing/blank
    raw_code = (building.code or "").strip()
    if not raw_code:
        base_code = "".join(ch for ch in building.name.upper() if ch.isalnum() or ch == "-")[:16] or "BLDG"
    else:
        base_code = raw_code.upper()[:16]

    code = base_code
    suffix = 1
    while db.query(Building).filter(Building.code == code).first():
        # Deterministically resolve collisions by suffixing a 2-digit counter
        suffix += 1
        code = f"{base_code[:14]}{suffix:02d}"[:16]

    db_building = Building(
        name=building.name,
        code=code,
        description=building.description,
        water_threshold=building.water_threshold or 10000.0,
        electricity_threshold=building.electricity_threshold or 5000.0,
        campus_name=campus_name,
        zone=building.zone,
        tags=building.tags,
        is_24x7=bool(building.is_24x7),
        created_by=current_user.id,
    )
    db.add(db_building)
    db.commit()
    db.refresh(db_building)
    return db_building

@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(
    building_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    return building

@router.put("/{building_id}", response_model=BuildingResponse)
def update_building(
    building_id: int,
    building_update: BuildingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    
    update_data = building_update.dict(exclude_unset=True)
    next_code = update_data.get("code")
    if next_code and next_code != building.code:
        existing = db.query(Building).filter(Building.code == next_code).first()
        if existing and existing.id != building.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Building code already exists",
            )
    for field, value in update_data.items():
        setattr(building, field, value)
    
    db.commit()
    db.refresh(building)
    return building

@router.delete("/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_building(
    building_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    
    db.delete(building)
    db.commit()
    return None
