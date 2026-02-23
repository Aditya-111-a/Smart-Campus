from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.database import get_db
from app.models import UtilityReading, Building, User, UtilityType
from app.schemas import ReadingCreate, ReadingResponse
from app.auth import get_current_active_user

router = APIRouter()

@router.post("/", response_model=ReadingResponse, status_code=201)
def create_reading(
    reading: ReadingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Verify building exists
    building = db.query(Building).filter(Building.id == reading.building_id).first()
    if not building:
        raise HTTPException(
            status_code=404,
            detail="Building not found"
        )
    
    # Set unit based on utility type
    unit = "liters" if reading.utility_type == UtilityType.WATER else "kWh"
    
    db_reading = UtilityReading(
        **reading.dict(),
        unit=unit,
        recorded_by=current_user.id
    )
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)
    
    # Trigger anomaly detection (async in production)
    from app.anomaly_detection import check_anomalies
    check_anomalies(db, db_reading)
    
    return db_reading

@router.get("/", response_model=List[ReadingResponse])
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
