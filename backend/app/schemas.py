from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from app.models import UserRole, UtilityType, AlertStatus, AlertType, ZoneCategory

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[UserRole] = UserRole.USER

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Building Schemas
class BuildingBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    water_threshold: Optional[float] = 10000.0
    electricity_threshold: Optional[float] = 5000.0
    # Campus context
    campus_name: Optional[str] = "VIT Vellore"
    zone: Optional[ZoneCategory] = None
    # Comma-separated tags, e.g. "academic,lab,24x7"
    tags: Optional[str] = None
    is_24x7: Optional[bool] = False
    iot_enabled: Optional[bool] = False

class BuildingCreate(BuildingBase):
    pass

class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    water_threshold: Optional[float] = None
    electricity_threshold: Optional[float] = None
    campus_name: Optional[str] = None
    zone: Optional[ZoneCategory] = None
    tags: Optional[str] = None
    is_24x7: Optional[bool] = None
    iot_enabled: Optional[bool] = None

class BuildingResponse(BuildingBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Reading Schemas
class ReadingBase(BaseModel):
    building_id: int
    utility_type: UtilityType
    value: float
    reading_date: datetime
    notes: Optional[str] = None

class ReadingCreate(ReadingBase):
    pass

class ReadingResponse(ReadingBase):
    id: int
    unit: str
    recorded_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Analytics Schemas
class TotalConsumption(BaseModel):
    total_water: float
    total_electricity: float
    period_start: datetime
    period_end: datetime
    sample_size: int | None = None
    filters: dict | None = None

class BuildingRanking(BaseModel):
    building_id: int
    building_name: str
    building_code: str
    total_consumption: float
    utility_type: UtilityType
    rank: int

class TimeSummary(BaseModel):
    period: str  # daily, weekly, monthly
    date: datetime
    total_water: float
    total_electricity: float
    building_breakdown: List[dict]


class ZoneStat(BaseModel):
    zone: str
    total: float
    sample_size: int


class AnalyticsStats(BaseModel):
    utility_type: UtilityType
    start_date: datetime
    end_date: datetime
    sample_size: int
    mean: float
    median: float
    variance: float
    std_dev: float
    per_zone: List[ZoneStat]

# Alert Schemas
class AlertBase(BaseModel):
    building_id: int
    alert_type: AlertType
    utility_type: UtilityType
    message: str
    severity: Optional[str] = "medium"

class AlertResponse(AlertBase):
    id: int
    reading_id: Optional[int] = None
    status: AlertStatus
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    building_name: Optional[str] = None

    class Config:
        from_attributes = True

class AlertUpdate(BaseModel):
    resolution_notes: Optional[str] = None

# Report Schemas
class ReportData(BaseModel):
    period_start: datetime
    period_end: datetime
    total_water: float
    total_electricity: float
    building_summaries: List[dict]
    top_consumers: List[BuildingRanking]
    alerts_generated: int
    anomalies_detected: int


# Admin import schemas
class ImportErrorRow(BaseModel):
    row_number: int
    error: str


class ImportSummary(BaseModel):
    total_rows: int
    success_count: int
    failed_count: int
    failed_rows: List[ImportErrorRow] = []
