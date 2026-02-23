"""
Seed database with sample data for testing
"""
from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, Building, UtilityReading, UserRole, UtilityType
from app.auth import get_password_hash
from app.vit_buildings import vit_building_definitions


def seed_data():
    db: Session = SessionLocal()
    
    try:
        # Create admin user
        admin = db.query(User).filter(User.email == "admin@campus.edu").first()
        if not admin:
            admin = User(
                email="admin@campus.edu",
                hashed_password=get_password_hash("admin123"),
                full_name="Admin User",
                role=UserRole.ADMIN
            )
            db.add(admin)
            print("Created admin user")
        
        # Create regular user
        user = db.query(User).filter(User.email == "user@campus.edu").first()
        if not user:
            user = User(
                email="user@campus.edu",
                hashed_password=get_password_hash("user123"),
                full_name="Regular User",
                role=UserRole.USER
            )
            db.add(user)
            print("Created regular user")
        
        db.commit()
        
        # Create canonical VIT Vellore buildings with campus context
        buildings_data = vit_building_definitions()
        
        buildings = []
        for b_data in buildings_data:
            building = db.query(Building).filter(Building.code == b_data["code"]).first()
            if not building:
                building = Building(
                    name=b_data["name"],
                    code=b_data["code"],
                    description=b_data.get("description"),
                    water_threshold=b_data.get("water_threshold", 10000),
                    electricity_threshold=b_data.get("electricity_threshold", 5000),
                    campus_name=b_data.get("campus_name", "VIT Vellore"),
                    zone=b_data.get("zone"),
                    tags=b_data.get("tags"),
                    is_24x7=b_data.get("is_24x7", False),
                    created_by=admin.id,
                )
                db.add(building)
                buildings.append(building)
                print(f"Created building: {b_data['name']}")
        
        db.commit()
        
        # Refresh buildings to get IDs
        for building in buildings:
            db.refresh(building)
        
        # Create sample readings for the last 30 days
        print("Creating sample readings...")
        base_date = datetime.utcnow() - timedelta(days=30)
        readings_created = 0
        
        for day in range(30):
            reading_date = base_date + timedelta(days=day)
            
            for building in buildings:
                # Water reading (morning)
                water_value = random.uniform(500, building.water_threshold * 0.9)
                reading = UtilityReading(
                    building_id=building.id,
                    utility_type=UtilityType.WATER,
                    value=round(water_value, 2),
                    unit="liters",
                    reading_date=reading_date.replace(hour=8, minute=0),
                    recorded_by=admin.id,
                    notes=f"Daily water reading"
                )
                db.add(reading)
                readings_created += 1
                
                # Electricity reading (evening)
                electricity_value = random.uniform(300, building.electricity_threshold * 0.9)
                reading = UtilityReading(
                    building_id=building.id,
                    utility_type=UtilityType.ELECTRICITY,
                    value=round(electricity_value, 2),
                    unit="kWh",
                    reading_date=reading_date.replace(hour=18, minute=0),
                    recorded_by=admin.id,
                    notes=f"Daily electricity reading"
                )
                db.add(reading)
                readings_created += 1
        
        db.commit()
        print(f"Created {readings_created} sample readings")
        print("\nSeed data created successfully!")
        print("\nDefault credentials:")
        print("Admin: admin@campus.edu / admin123")
        print("User: user@campus.edu / user123")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
