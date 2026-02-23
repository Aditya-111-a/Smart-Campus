from __future__ import annotations

import hashlib
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request
from jose import JWTError, jwt
from sqlalchemy import inspect, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Building, UtilityReading, Alert, User


router = APIRouter()


@router.get("/health")
async def system_health(
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Lightweight system health endpoint.

    - Auth status (if Authorization header present)
    - Current user email/role (if token is valid)
    - Basic entity counts
    - Schema signature hash to detect drift between code and DB
    """
    # --- Auth status / current user (non-fatal) ---
    auth_header = request.headers.get("Authorization", "")
    has_auth_header = bool(auth_header)

    current_user_email: Optional[str] = None
    current_user_role: Optional[str] = None
    auth_status = "unauthenticated"

    if has_auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                raw_token,
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            email = payload.get("sub")
            role = payload.get("role")
            if email:
                user = (
                    db.query(User)
                    .filter(User.email == email)
                    .first()
                )
                if user:
                    current_user_email = user.email
                    current_user_role = (
                        user.role.value
                        if hasattr(user.role, "value")
                        else str(user.role)
                    )
                    auth_status = "authenticated"
                else:
                    auth_status = "invalid_token"
            else:
                auth_status = "invalid_token"
        except JWTError:
            auth_status = "invalid_token"

    # --- Counts ---
    building_count = db.query(func.count(Building.id)).scalar() or 0
    reading_count = db.query(func.count(UtilityReading.id)).scalar() or 0
    alert_count = db.query(func.count(Alert.id)).scalar() or 0

    # --- Schema signature (rough, but stable for a given model set) ---
    inspector = inspect(db.bind)
    tables = {}
    for table_name in sorted(inspector.get_table_names()):
        cols = inspector.get_columns(table_name)
        tables[table_name] = [
            {
                "name": c["name"],
                "type": str(c["type"]),
                "nullable": c.get("nullable", True),
            }
            for c in cols
        ]

    raw = repr(sorted(tables.items()))
    schema_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    return {
        "status": "ok",
        "auth": {
            "status": auth_status,
            "user": {
                "email": current_user_email,
                "role": current_user_role,
            }
            if current_user_email
            else None,
            "has_authorization_header": has_auth_header,
        },
        "counts": {
            "buildings": building_count,
            "readings": reading_count,
            "alerts": alert_count,
        },
        "schema": {
            "hash": schema_hash,
            "backend_version": "1.0.0",
        },
    }

