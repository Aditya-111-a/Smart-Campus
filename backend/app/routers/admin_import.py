from io import BytesIO
from typing import List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_admin_user
from app.database import get_db, engine
from app.models import Building, UtilityReading, UtilityType, User
from app.schemas import ImportSummary, ImportErrorRow
from app.anomaly_detection import check_anomalies
from app.vit_buildings import vit_building_definitions
import seed_data


router = APIRouter()


@router.post("/import-readings", response_model=ImportSummary, status_code=status.HTTP_201_CREATED)
async def import_readings(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> ImportSummary:
    """
    Import utility readings from CSV or Excel.

    Required columns (case-insensitive):
      - timestamp
      - building
      - utility   (water / electricity)
      - value
    """
    filename = file.filename or ""
    suffix = (filename.rsplit(".", 1)[-1] or "").lower()
    if suffix not in {"csv", "xlsx"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Only .csv and .xlsx are allowed.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        buffer = BytesIO(content)
        if suffix == "csv":
            df = pd.read_csv(buffer)
        else:
            df = pd.read_excel(buffer)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read file. Ensure it is a valid CSV or Excel file.",
        )

    # Normalise columns to lower-case keys
    df.columns = [str(c).strip().lower() for c in df.columns]
    required_cols = {"timestamp", "building", "utility", "value"}
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(sorted(missing))}",
        )

    total_rows = len(df)
    success_count = 0
    failed_rows: List[ImportErrorRow] = []

    for idx, row in df.iterrows():
        row_number = idx + 2  # header is row 1
        try:
            timestamp_raw = row.get("timestamp")
            building_label = str(row.get("building")).strip()
            utility_raw = str(row.get("utility")).strip().lower()
            value_raw = row.get("value")

            if not building_label:
                raise ValueError("building is empty")

            try:
                # Normalise all timestamps to UTC
                reading_ts = pd.to_datetime(timestamp_raw, utc=True)
            except Exception:
                raise ValueError(f"invalid timestamp: {timestamp_raw!r}")

            try:
                value = float(value_raw)
            except Exception:
                raise ValueError(f"invalid value: {value_raw!r}")

            if utility_raw not in ("water", "electricity"):
                raise ValueError(f"invalid utility: {utility_raw!r}")

            utility_type = UtilityType.WATER if utility_raw == "water" else UtilityType.ELECTRICITY
            unit = "liters" if utility_type == UtilityType.WATER else "kWh"

            # Find or create building by code or name
            building = (
                db.query(Building)
                .filter(
                    (Building.code == building_label)
                    | (Building.name == building_label)
                )
                .first()
            )
            if not building:
                # Derive a deterministic code from the label (uppercase, no spaces)
                base_code = "".join(ch for ch in building_label.upper() if ch.isalnum())[:16] or building_label[:16]
                code = base_code
                suffix = 1
                while (
                    db.query(Building)
                    .filter(Building.code == code)
                    .first()
                ):
                    suffix += 1
                    code = f"{base_code[:14]}{suffix:02d}"[:16]

                building = Building(
                    name=building_label,
                    code=code,
                    description="Imported from readings file",
                    campus_name="VIT Vellore",
                    created_by=current_user.id,
                )
                db.add(building)
                db.flush()  # get id

            db_reading = UtilityReading(
                building_id=building.id,
                utility_type=utility_type,
                value=value,
                unit=unit,
                reading_date=reading_ts.to_pydatetime(),
                recorded_by=current_user.id,
                notes="Imported via admin CSV/Excel",
            )
            db.add(db_reading)
            db.flush()

            # Run anomaly checks for this reading
            check_anomalies(db, db_reading)

            success_count += 1
        except Exception as exc:
            failed_rows.append(
                ImportErrorRow(row_number=row_number, error=str(exc))
            )
            # Do not abort the whole import; continue with other rows
            db.rollback()

    # Final commit for all successfully added rows
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to commit imported readings.",
        )

    return ImportSummary(
        total_rows=total_rows,
        success_count=success_count,
        failed_count=len(failed_rows),
        failed_rows=failed_rows,
    )


@router.post("/seed-buildings")
async def seed_vit_buildings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Idempotently seed the canonical VIT Vellore building dataset.
    """
    definitions = vit_building_definitions()
    created = 0
    updated = 0

    for data in definitions:
        existing = (
            db.query(Building)
            .filter(Building.code == data["code"])
            .first()
        )
        if existing:
            # Keep codes stable, update descriptive fields to canonical values
            existing.name = data["name"]
            existing.description = data.get("description", existing.description)
            existing.water_threshold = data.get("water_threshold", existing.water_threshold)
            existing.electricity_threshold = data.get("electricity_threshold", existing.electricity_threshold)
            existing.campus_name = data.get("campus_name", existing.campus_name or "VIT Vellore")
            existing.zone = data.get("zone", existing.zone)
            existing.tags = data.get("tags", existing.tags)
            existing.is_24x7 = data.get("is_24x7", existing.is_24x7)
            updated += 1
        else:
            building = Building(
                name=data["name"],
                code=data["code"],
                description=data.get("description"),
                water_threshold=data.get("water_threshold", 10000),
                electricity_threshold=data.get("electricity_threshold", 5000),
                campus_name=data.get("campus_name", "VIT Vellore"),
                zone=data.get("zone"),
                tags=data.get("tags"),
                is_24x7=data.get("is_24x7", False),
                created_by=current_user.id,
            )
            db.add(building)
            created += 1

    db.commit()

    return {
        "created": created,
        "updated": updated,
        "total": created + updated,
    }


@router.post("/reset-vit-demo")
async def reset_vit_demo(
    current_user: User = Depends(get_current_admin_user),
):
    """
    Dev-only: drop and recreate all tables, then reseed canonical VIT demo data.
    """
    from app.database import Base

    # Hard guard: only allow in debug/dev environments
    from app.config import settings

    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reset is only allowed in debug/development mode.",
        )

    # Drop and recreate schema
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Seed default data (admin/user + VIT buildings + sample readings)
    seed_data.seed_data()

    return {
        "status": "ok",
        "message": "Database reset to VIT default demo state.",
    }

