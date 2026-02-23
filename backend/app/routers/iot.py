from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Building, UtilityReading, UtilityType
from app.schemas import ReadingResponse
from app.anomaly_detection import check_anomalies


router = APIRouter()


def verify_iot_api_key(x_api_key: Optional[str] = Header(None)) -> None:
    configured_key = settings.iot_api_key
    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="IoT ingestion is not configured (missing IOT_API_KEY).",
        )
    if not x_api_key or x_api_key != configured_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


@router.post("/ingest", response_model=ReadingResponse, status_code=status.HTTP_201_CREATED)
def ingest_reading(
    device_id: str,
    building_code: str,
    utility: UtilityType,
    value: float,
    timestamp: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _: None = Depends(verify_iot_api_key),
):
    """
    IoT / device ingestion endpoint.

    - Auth: X-API-Key header must match settings.iot_api_key
    - Device is mapped to a building via `building_code`
    """
    building = (
        db.query(Building)
        .filter(Building.code == building_code)
        .first()
    )
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Building with code '{building_code}' not found.",
        )

    if not getattr(building, "iot_enabled", False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="IoT ingestion is disabled for this building.",
        )

    reading_date = timestamp or datetime.utcnow()
    unit = "liters" if utility == UtilityType.WATER else "kWh"

    db_reading = UtilityReading(
        building_id=building.id,
        utility_type=utility,
        value=value,
        unit=unit,
        reading_date=reading_date,
        notes=f"IoT ingestion from device {device_id}",
    )
    db.add(db_reading)
    db.flush()

    # Trigger anomaly detection
    check_anomalies(db, db_reading)
    db.commit()
    db.refresh(db_reading)

    return db_reading

