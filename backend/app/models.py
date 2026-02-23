from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class UtilityType(str, enum.Enum):
    WATER = "water"
    ELECTRICITY = "electricity"


class ZoneCategory(str, enum.Enum):
    ACADEMIC = "academic"
    RESIDENTIAL = "residential"  # Hostels
    RESEARCH = "research"
    ADMINISTRATION = "administration"
    COMMON = "common"  # Common facilities

class AlertStatus(str, enum.Enum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"

class AlertType(str, enum.Enum):
    SPIKE = "spike"
    THRESHOLD_BREACH = "threshold_breach"
    CONTINUOUS_HIGH = "continuous_high"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    buildings = relationship("Building", back_populates="created_by_user")

class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    description = Column(String)
    water_threshold = Column(Float, default=10000.0)  # Daily threshold in liters
    electricity_threshold = Column(Float, default=5000.0)  # Daily threshold in kWh
    # Campus context
    campus_name = Column(String, default="VIT Vellore", index=True)
    zone = Column(SQLEnum(ZoneCategory), nullable=True, index=True)
    # Comma-separated tags, e.g. "academic,lab,24x7"
    tags = Column(String)
    is_24x7 = Column(Boolean, default=False)
    # IoT ingestion toggle (stub-only, per-building enable/disable)
    iot_enabled = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    created_by_user = relationship("User", back_populates="buildings")
    readings = relationship("UtilityReading", back_populates="building")
    alerts = relationship("Alert", back_populates="building")

class UtilityReading(Base):
    __tablename__ = "utility_readings"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)
    utility_type = Column(SQLEnum(UtilityType), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String, default="liters")  # liters for water, kWh for electricity
    reading_date = Column(DateTime(timezone=True), nullable=False, index=True)
    recorded_by = Column(Integer, ForeignKey("users.id"))
    notes = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    building = relationship("Building", back_populates="readings")
    recorded_by_user = relationship("User")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)
    alert_type = Column(SQLEnum(AlertType), nullable=False)
    utility_type = Column(SQLEnum(UtilityType), nullable=False)
    severity = Column(String, default="medium")  # low, medium, high
    message = Column(String, nullable=False)
    reading_id = Column(Integer, ForeignKey("utility_readings.id"))
    status = Column(SQLEnum(AlertStatus), default=AlertStatus.PENDING)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    building = relationship("Building", back_populates="alerts")
    reading = relationship("UtilityReading")
    acknowledged_by_user = relationship("User", foreign_keys=[acknowledged_by])
    resolved_by_user = relationship("User", foreign_keys=[resolved_by])
