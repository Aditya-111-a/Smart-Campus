from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Building, User
from app.schemas import BuildingCreate, BuildingUpdate, BuildingResponse
from app.auth import get_current_active_user

router = APIRouter()


@router.get("/", response_model=List[BuildingResponse])
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


@router.post("/", response_model=BuildingResponse, status_code=status.HTTP_201_CREATED)
def create_building(
    building: BuildingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user)
):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found"
        )
    
    update_data = building_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(building, field, value)
    
    db.commit()
    db.refresh(building)
    return building

@router.delete("/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_building(
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
    
    db.delete(building)
    db.commit()
    return None
