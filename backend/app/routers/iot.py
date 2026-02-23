from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Building, UtilityReading, UtilityType, IoTDevice, User
from app.schemas import ReadingResponse, IoTDeviceCreate, IoTDeviceUpdate, IoTDeviceResponse, IoTIngestRequest
from app.anomaly_detection import check_anomalies
from app.auth import get_current_admin_user


router = APIRouter()


def verify_global_iot_api_key(x_api_key: Optional[str]) -> bool:
    configured_key = settings.iot_api_key
    if not configured_key:
        return False
    return bool(x_api_key and x_api_key == configured_key)


@router.get('/devices', response_model=List[IoTDeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    return db.query(IoTDevice).order_by(IoTDevice.created_at.desc()).all()


@router.post('/devices', response_model=IoTDeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: IoTDeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    building = db.query(Building).filter(Building.id == payload.building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail='Building not found')

    existing = db.query(IoTDevice).filter(IoTDevice.device_id == payload.device_id).first()
    if existing:
        raise HTTPException(status_code=400, detail='Device ID already exists')

    device = IoTDevice(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.put('/devices/{device_id}', response_model=IoTDeviceResponse)
def update_device(
    device_id: int,
    payload: IoTDeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    device = db.query(IoTDevice).filter(IoTDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail='Device not found')

    data = payload.model_dump(exclude_unset=True)
    if 'building_id' in data:
        building = db.query(Building).filter(Building.id == data['building_id']).first()
        if not building:
            raise HTTPException(status_code=404, detail='Building not found')

    for field, value in data.items():
        setattr(device, field, value)

    db.commit()
    db.refresh(device)
    return device


@router.delete('/devices/{device_id}', status_code=204)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    device = db.query(IoTDevice).filter(IoTDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail='Device not found')
    db.delete(device)
    db.commit()
    return None


@router.post('/ingest', response_model=ReadingResponse, status_code=status.HTTP_201_CREATED)
def ingest_reading(
    payload: IoTIngestRequest,
    db: Session = Depends(get_db),
    x_api_key: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
):
    """
    IoT/device ingestion endpoint.

    Supported auth modes:
    - Global integration key: X-API-Key == settings.iot_api_key (for gateways/batch integrations)
    - Per-device key: X-Device-Key matched against registered device
    """
    building: Optional[Building] = None

    using_global_key = verify_global_iot_api_key(x_api_key)
    if using_global_key:
        if not payload.building_code:
            raise HTTPException(status_code=422, detail='building_code is required when using global API key')
        building = db.query(Building).filter(Building.code == payload.building_code).first()
        if not building:
            raise HTTPException(status_code=404, detail=f"Building with code '{payload.building_code}' not found")
    else:
        if not x_device_key:
            raise HTTPException(status_code=401, detail='Missing auth key. Provide X-API-Key or X-Device-Key.')

        device = db.query(IoTDevice).filter(IoTDevice.device_id == payload.device_id).first()
        if not device or not device.is_active:
            raise HTTPException(status_code=401, detail='Invalid or inactive device')
        if device.device_key != x_device_key:
            raise HTTPException(status_code=401, detail='Invalid device key')

        if payload.utility != device.utility_type:
            raise HTTPException(status_code=422, detail='Payload utility does not match device utility type')

        building = db.query(Building).filter(Building.id == device.building_id).first()
        if not building:
            raise HTTPException(status_code=404, detail='Mapped building not found')

        device.last_seen_at = datetime.utcnow()

    if not getattr(building, 'iot_enabled', False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='IoT ingestion is disabled for this building.',
        )

    reading_date = payload.timestamp or datetime.utcnow()
    unit = 'liters' if payload.utility == UtilityType.WATER else 'kWh'

    db_reading = UtilityReading(
        building_id=building.id,
        utility_type=payload.utility,
        value=payload.value,
        unit=unit,
        reading_date=reading_date,
        notes=f'IoT ingestion from device {payload.device_id}',
    )
    db.add(db_reading)
    db.flush()

    check_anomalies(db, db_reading)
    db.commit()
    db.refresh(db_reading)

    return db_reading
