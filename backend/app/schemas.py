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
    code: Optional[str] = None
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


class BuildingOverviewItem(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    campus_name: Optional[str] = "VIT Vellore"
    zone: Optional[ZoneCategory] = None
    tags: Optional[str] = None
    is_24x7: bool = False
    iot_enabled: bool = False
    water_threshold: float = 0.0
    electricity_threshold: float = 0.0
    water_total: float = 0.0
    electricity_total: float = 0.0
    total_consumption: float = 0.0
    water_trend_pct: float = 0.0
    electricity_trend_pct: float = 0.0
    sample_size: int = 0


class BuildingOverviewResponse(BaseModel):
    campus_name: str
    start_date: datetime
    end_date: datetime
    previous_start_date: datetime
    previous_end_date: datetime
    sample_size: int
    buildings: List[BuildingOverviewItem]

# Reading Schemas
class ReadingBase(BaseModel):
    building_id: int
    utility_type: UtilityType
    value: float
    reading_date: datetime
    notes: Optional[str] = None

class ReadingCreate(ReadingBase):
    pass


class ReadingUpdate(BaseModel):
    building_id: Optional[int] = None
    utility_type: Optional[UtilityType] = None
    value: Optional[float] = None
    reading_date: Optional[datetime] = None
    notes: Optional[str] = None

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


class AnalyticsSeriesPoint(BaseModel):
    date: datetime
    value: float
    moving_average: float
    cumulative_sum: float
    z_score: float
    is_anomaly: bool
    building_id: int
    building_name: str
    zone: str


class AnalyticsAggregation(BaseModel):
    key: str
    label: str
    total: float
    sample_size: int
    mean: float
    threshold_breaches: int
    anomalies: int


class AnalyticsInsights(BaseModel):
    utility_type: UtilityType
    start_date: datetime
    end_date: datetime
    sample_size: int
    filters: dict
    mean: float
    median: float
    variance: float
    std_dev: float
    cumulative_sum: float
    moving_average_window: int
    threshold_breaches: int
    anomalies_detected: int
    per_building: List[AnalyticsAggregation]
    per_zone: List[AnalyticsAggregation]
    series: List[AnalyticsSeriesPoint]

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


class AlertRuleBase(BaseModel):
    name: str
    is_active: bool = True
    scope_type: str = "global"  # global | zone | building
    building_id: Optional[int] = None
    zone: Optional[ZoneCategory] = None
    utility_type: UtilityType
    condition_type: str  # threshold | zscore | rate_of_change
    threshold_value: float
    comparison_window_days: int = 7
    consecutive_count: int = 1
    severity: str = "medium"


class AlertRuleCreate(AlertRuleBase):
    pass


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    scope_type: Optional[str] = None
    building_id: Optional[int] = None
    zone: Optional[ZoneCategory] = None
    utility_type: Optional[UtilityType] = None
    condition_type: Optional[str] = None
    threshold_value: Optional[float] = None
    comparison_window_days: Optional[int] = None
    consecutive_count: Optional[int] = None
    severity: Optional[str] = None


class AlertRuleResponse(AlertRuleBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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


class IoTDeviceBase(BaseModel):
    device_id: str
    name: str
    building_id: int
    utility_type: UtilityType
    is_active: bool = True


class IoTDeviceCreate(IoTDeviceBase):
    device_key: str


class IoTDeviceUpdate(BaseModel):
    name: Optional[str] = None
    building_id: Optional[int] = None
    utility_type: Optional[UtilityType] = None
    device_key: Optional[str] = None
    is_active: Optional[bool] = None


class IoTDeviceResponse(IoTDeviceBase):
    id: int
    last_seen_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IoTIngestRequest(BaseModel):
    device_id: str
    utility: UtilityType
    value: float
    timestamp: Optional[datetime] = None
    building_code: Optional[str] = None
