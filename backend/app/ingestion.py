from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.anomaly_detection import check_anomalies
from app.models import Building, UtilityReading, UtilityType
from app.schemas import ReadingCreate


def parse_import_timestamp(raw_timestamp: object) -> datetime:
    try:
        ts = pd.to_datetime(raw_timestamp, utc=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid timestamp: {raw_timestamp!r}") from exc
    return ts.to_pydatetime()


def parse_import_utility(raw_utility: object) -> UtilityType:
    label = str(raw_utility or "").strip().lower()
    aliases = {
        "water": UtilityType.WATER,
        "w": UtilityType.WATER,
        "electricity": UtilityType.ELECTRICITY,
        "electric": UtilityType.ELECTRICITY,
        "power": UtilityType.ELECTRICITY,
        "e": UtilityType.ELECTRICITY,
    }
    utility = aliases.get(label)
    if not utility:
        raise ValueError(f"invalid utility: {label!r}")
    return utility


def parse_import_value(raw_value: object) -> float:
    try:
        value = float(raw_value)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid value: {raw_value!r}") from exc
    if value < 0:
        raise ValueError("value must be >= 0")
    return value


def resolve_building_for_import(db: Session, building_label: str, created_by: int) -> Building:
    normalized = (building_label or "").strip()
    if not normalized:
        raise ValueError("building is empty")

    building = (
        db.query(Building)
        .filter(
            (Building.code == normalized)
            | (Building.name == normalized)
        )
        .first()
    )
    if building:
        return building

    base_code = "".join(ch for ch in normalized.upper() if ch.isalnum() or ch == "-")[:16] or "BLDG"
    code = base_code
    suffix = 1
    while db.query(Building).filter(Building.code == code).first():
        suffix += 1
        code = f"{base_code[:14]}{suffix:02d}"[:16]

    building = Building(
        name=normalized,
        code=code,
        description="Imported from readings file",
        campus_name="VIT Vellore",
        created_by=created_by,
    )
    db.add(building)
    db.flush()
    return building


def create_reading_from_payload(
    db: Session,
    payload: ReadingCreate,
    recorded_by: int,
    notes: Optional[str] = None,
) -> UtilityReading:
    building = db.query(Building).filter(Building.id == payload.building_id).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found",
        )

    unit = "liters" if payload.utility_type == UtilityType.WATER else "kWh"
    payload_data = payload.model_dump()
    payload_data.pop("notes", None)

    db_reading = UtilityReading(
        **payload_data,
        unit=unit,
        recorded_by=recorded_by,
        notes=notes if notes is not None else payload.notes,
    )
    db.add(db_reading)
    db.flush()
    check_anomalies(db, db_reading)
    return db_reading
