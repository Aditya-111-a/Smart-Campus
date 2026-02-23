from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import statistics

from app.models import UtilityReading, Alert, Building, AlertType, AlertStatus, UtilityType

def check_anomalies(db: Session, reading: UtilityReading):
    """Check for anomalies in a new reading and create alerts if found"""
    building = db.query(Building).filter(Building.id == reading.building_id).first()
    if not building:
        return
    
    alerts_created = []
    
    # 1. Check threshold breach
    threshold = (
        building.water_threshold if reading.utility_type == UtilityType.WATER
        else building.electricity_threshold
    )
    
    if reading.value > threshold:
        alert = Alert(
            building_id=reading.building_id,
            alert_type=AlertType.THRESHOLD_BREACH,
            utility_type=reading.utility_type,
            message=f"{reading.utility_type.value.capitalize()} consumption ({reading.value:.2f} {reading.unit}) exceeds threshold ({threshold:.2f} {reading.unit})",
            severity="high",
            reading_id=reading.id
        )
        db.add(alert)
        alerts_created.append(alert)
    
    # 2. Check for spike (compare with recent readings)
    recent_readings = db.query(UtilityReading).filter(
        and_(
            UtilityReading.building_id == reading.building_id,
            UtilityReading.utility_type == reading.utility_type,
            UtilityReading.id != reading.id,
            UtilityReading.reading_date >= reading.reading_date - timedelta(days=7)
        )
    ).all()
    
    if len(recent_readings) >= 3:
        values = [r.value for r in recent_readings]
        mean = statistics.mean(values)
        stdev = statistics.stdev(values) if len(values) > 1 else 0
        
        if stdev > 0:
            z_score = (reading.value - mean) / stdev
            if z_score > 2.5:  # Significant spike
                alert = Alert(
                    building_id=reading.building_id,
                    alert_type=AlertType.SPIKE,
                    utility_type=reading.utility_type,
                    message=f"Spike detected: {reading.utility_type.value.capitalize()} consumption ({reading.value:.2f} {reading.unit}) is {z_score:.2f} standard deviations above recent average ({mean:.2f} {reading.unit})",
                    severity="medium",
                    reading_id=reading.id
                )
                db.add(alert)
                alerts_created.append(alert)
    
    # 3. Check for continuous high usage (last 3+ days above threshold)
    recent_days = db.query(UtilityReading).filter(
        and_(
            UtilityReading.building_id == reading.building_id,
            UtilityReading.utility_type == reading.utility_type,
            UtilityReading.reading_date >= reading.reading_date - timedelta(days=3),
            UtilityReading.value > threshold * 0.8  # 80% of threshold
        )
    ).all()
    
    if len(recent_days) >= 3:
        # Check if there's already a pending continuous high alert
        existing_alert = db.query(Alert).filter(
            and_(
                Alert.building_id == reading.building_id,
                Alert.utility_type == reading.utility_type,
                Alert.alert_type == AlertType.CONTINUOUS_HIGH,
                Alert.status == AlertStatus.PENDING
            )
        ).first()
        
        if not existing_alert:
            alert = Alert(
                building_id=reading.building_id,
                alert_type=AlertType.CONTINUOUS_HIGH,
                utility_type=reading.utility_type,
                message=f"Continuous high {reading.utility_type.value} usage detected: {len(recent_days)} consecutive days above 80% of threshold",
                severity="medium",
                reading_id=reading.id
            )
            db.add(alert)
            alerts_created.append(alert)
    
    if alerts_created:
        db.commit()
