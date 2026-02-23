from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.database import get_db
from app.models import UtilityReading, User, UtilityType, Building, Alert
from app.schemas import ReadingCreate, ReadingResponse, ReadingUpdate
from app.auth import get_current_active_user, get_current_admin_user
from app.ingestion import create_reading_from_payload

router = APIRouter()

@router.post("", response_model=ReadingResponse, status_code=201)
def create_reading(
    reading: ReadingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_reading = create_reading_from_payload(
        db=db,
        payload=reading,
        recorded_by=current_user.id,
    )
    db.commit()
    db.refresh(db_reading)

    return db_reading

@router.get("", response_model=List[ReadingResponse])
def list_readings(
    building_id: Optional[int] = Query(None),
    utility_type: Optional[UtilityType] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from sqlalchemy.orm import joinedload
    query = db.query(UtilityReading).options(joinedload(UtilityReading.building))
    
    if building_id:
        query = query.filter(UtilityReading.building_id == building_id)
    if utility_type:
        query = query.filter(UtilityReading.utility_type == utility_type)
    if start_date:
        query = query.filter(UtilityReading.reading_date >= start_date)
    if end_date:
        query = query.filter(UtilityReading.reading_date <= end_date)
    
    readings = query.order_by(UtilityReading.reading_date.desc()).offset(skip).limit(limit).all()
    return readings

@router.get("/{reading_id}", response_model=ReadingResponse)
def get_reading(
    reading_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    reading = db.query(UtilityReading).filter(UtilityReading.id == reading_id).first()
    if not reading:
        raise HTTPException(
            status_code=404,
            detail="Reading not found"
        )
    return reading


@router.put("/{reading_id}", response_model=ReadingResponse)
def update_reading(
    reading_id: int,
    reading_update: ReadingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    reading = db.query(UtilityReading).filter(UtilityReading.id == reading_id).first()
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")

    update_data = reading_update.dict(exclude_unset=True)
    if "building_id" in update_data:
        exists = db.query(Building).filter(Building.id == update_data["building_id"]).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Building not found")

    if "utility_type" in update_data:
        utility_type = update_data["utility_type"]
        reading.unit = "liters" if utility_type == UtilityType.WATER else "kWh"

    for field, value in update_data.items():
        setattr(reading, field, value)

    db.commit()
    db.refresh(reading)
    return reading


@router.delete("/{reading_id}", status_code=204)
def delete_reading(
    reading_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    reading = db.query(UtilityReading).filter(UtilityReading.id == reading_id).first()
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")
    # Preserve alert history while removing the reading row.
    db.query(Alert).filter(Alert.reading_id == reading_id).update({"reading_id": None})
    db.delete(reading)
    db.commit()
    return None
