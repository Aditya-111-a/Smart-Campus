from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import statistics

from app.models import UtilityReading, Alert, Building, AlertType, AlertStatus, UtilityType, AlertRule

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

    # 4. Dynamic rule-based checks (admin-managed rules)
    active_rules = db.query(AlertRule).filter(
        and_(
            AlertRule.is_active == True,  # noqa: E712
            AlertRule.utility_type == reading.utility_type,
        )
    ).all()

    for rule in active_rules:
        # Scope matching
        if rule.scope_type == "building" and rule.building_id != reading.building_id:
            continue
        if rule.scope_type == "zone":
            zone = building.zone.value if hasattr(building.zone, "value") else building.zone
            rule_zone = rule.zone.value if hasattr(rule.zone, "value") else rule.zone
            if zone != rule_zone:
                continue

        triggered = False
        reason = ""
        window_days = max(1, int(rule.comparison_window_days or 1))

        if rule.condition_type == "threshold":
            threshold_value = float(rule.threshold_value)
            if int(rule.consecutive_count or 1) > 1:
                recent = db.query(UtilityReading).filter(
                    and_(
                        UtilityReading.building_id == reading.building_id,
                        UtilityReading.utility_type == reading.utility_type,
                    )
                ).order_by(UtilityReading.reading_date.desc()).limit(int(rule.consecutive_count)).all()
                if len(recent) >= int(rule.consecutive_count) and all(r.value > threshold_value for r in recent):
                    triggered = True
                    reason = f"{len(recent)} consecutive readings above {threshold_value:.2f} {reading.unit}"
            elif reading.value > threshold_value:
                triggered = True
                reason = f"value {reading.value:.2f} > threshold {threshold_value:.2f} {reading.unit}"

        elif rule.condition_type == "zscore":
            recent = db.query(UtilityReading).filter(
                and_(
                    UtilityReading.building_id == reading.building_id,
                    UtilityReading.utility_type == reading.utility_type,
                    UtilityReading.id != reading.id,
                    UtilityReading.reading_date >= reading.reading_date - timedelta(days=window_days),
                )
            ).all()
            if len(recent) >= 3:
                values = [r.value for r in recent]
                mean = statistics.mean(values)
                stdev = statistics.stdev(values) if len(values) > 1 else 0.0
                if stdev > 0:
                    z_score = (reading.value - mean) / stdev
                    if z_score > float(rule.threshold_value):
                        triggered = True
                        reason = f"z-score {z_score:.2f} > {float(rule.threshold_value):.2f}"

        elif rule.condition_type == "rate_of_change":
            prev = db.query(UtilityReading).filter(
                and_(
                    UtilityReading.building_id == reading.building_id,
                    UtilityReading.utility_type == reading.utility_type,
                    UtilityReading.id != reading.id,
                    UtilityReading.reading_date < reading.reading_date,
                )
            ).order_by(UtilityReading.reading_date.desc()).first()
            if prev and prev.value > 0:
                pct = ((reading.value - prev.value) / prev.value) * 100.0
                if pct > float(rule.threshold_value):
                    triggered = True
                    reason = f"rate-of-change {pct:.2f}% > {float(rule.threshold_value):.2f}%"

        if not triggered:
            continue

        # Avoid duplicate pending rule alerts for the same reading
        existing = db.query(Alert).filter(
            and_(
                Alert.reading_id == reading.id,
                Alert.alert_type == AlertType.RULE_TRIGGER,
                Alert.status == AlertStatus.PENDING,
            )
        ).first()
        if existing:
            continue

        utility_label = reading.utility_type.value.capitalize()
        if rule.condition_type == "threshold":
            friendly_message = (
                f"{utility_label} reading {reading.value:.2f} {reading.unit} exceeded configured limit "
                f"{float(rule.threshold_value):.2f} {reading.unit}."
            )
        elif rule.condition_type == "zscore":
            friendly_message = (
                f"{utility_label} reading {reading.value:.2f} {reading.unit} deviated significantly from recent pattern."
            )
        else:
            friendly_message = (
                f"{utility_label} usage changed too quickly compared to previous readings."
            )

        dynamic_alert = Alert(
            building_id=reading.building_id,
            alert_type=AlertType.RULE_TRIGGER,
            utility_type=reading.utility_type,
            message=friendly_message,
            severity=rule.severity or "medium",
            reading_id=reading.id,
        )
        db.add(dynamic_alert)
        alerts_created.append(dynamic_alert)
    
    if alerts_created:
        db.flush()
