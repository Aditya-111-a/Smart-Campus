from __future__ import annotations

from typing import List, Dict, Any

from app.models import ZoneCategory


def vit_building_definitions() -> List[Dict[str, Any]]:
  """
  Canonical VIT Vellore building dataset.

  Codes and names are stable; thresholds are sensible defaults.
  """
  campus = "VIT Vellore"

  academic_common = [
      # Academic / teaching & labs
      {
          "name": "Technology Tower",
          "code": "TT",
          "description": "Technology Tower (Academic)",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic,lab,24x7",
          "is_24x7": True,
          "water_threshold": 15000,
          "electricity_threshold": 9000,
      },
      {
          "name": "Silver Jubilee Tower",
          "code": "SJT",
          "description": "Silver Jubilee Tower (Academic)",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic,lab",
          "is_24x7": False,
          "water_threshold": 18000,
          "electricity_threshold": 11000,
      },
      {
          "name": "Sri M. Vishweshwaraiah Building",
          "code": "SMV",
          "description": "Sri M. Vishweshwaraiah Building",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic,lab",
          "is_24x7": False,
          "water_threshold": 16000,
          "electricity_threshold": 10000,
      },
      {
          "name": "G.D. Naidu Block",
          "code": "GDN",
          "description": "G.D. Naidu Academic Block",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic",
          "is_24x7": False,
          "water_threshold": 14000,
          "electricity_threshold": 9000,
      },
      {
          "name": "CBMR Building",
          "code": "CBMR",
          "description": "Centre for Bio-Medical Research Building",
          "zone": ZoneCategory.RESEARCH,
          "tags": "research,lab",
          "is_24x7": False,
          "water_threshold": 12000,
          "electricity_threshold": 8000,
      },
      {
          "name": "CDMM Building",
          "code": "CDMM",
          "description": "CDMM Building",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic,lab",
          "is_24x7": False,
          "water_threshold": 12000,
          "electricity_threshold": 8000,
      },
      {
          "name": "A.L. Mudaliar Block",
          "code": "ALM",
          "description": "A.L. Mudaliar Block",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic",
          "is_24x7": False,
          "water_threshold": 12000,
          "electricity_threshold": 8000,
      },
      {
          "name": "Gandhi Block",
          "code": "GANDHI",
          "description": "Gandhi Block",
          "zone": ZoneCategory.ACADEMIC,
          "tags": "academic",
          "is_24x7": False,
          "water_threshold": 12000,
          "electricity_threshold": 8000,
      },
      # Common / shared facilities
      {
          "name": "Library Building",
          "code": "LIB",
          "description": "Central Library Building",
          "zone": ZoneCategory.COMMON,
          "tags": "common,academic",
          "is_24x7": False,
          "water_threshold": 15000,
          "electricity_threshold": 9000,
      },
      {
          "name": "Centre for Technical Support",
          "code": "CTS",
          "description": "Centre for Technical Support",
          "zone": ZoneCategory.COMMON,
          "tags": "common,services",
          "is_24x7": False,
          "water_threshold": 8000,
          "electricity_threshold": 6000,
      },
      {
          "name": "PRP / PEARL Block",
          "code": "PEARL",
          "description": "PRP / PEARL Block",
          "zone": ZoneCategory.COMMON,
          "tags": "events,common",
          "is_24x7": False,
          "water_threshold": 10000,
          "electricity_threshold": 7000,
      },
  ]

  # Boys hostels MH-A ... MH-T (excluding I, O as per naming)
  boys_hostels = []
  for code in ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T"]:
      label = f"MH-{code}"
      boys_hostels.append(
          {
              "name": label,
              "code": label,
              "description": f"Men's Hostel {code}",
              "zone": ZoneCategory.RESIDENTIAL,
              "tags": "hostel,residential,24x7",
              "is_24x7": True,
              "water_threshold": 26000,
              "electricity_threshold": 8000,
          }
      )

  # Girls hostels LH-A ... LH-H
  girls_hostels = []
  for code in ["A", "B", "C", "D", "E", "F", "G", "H"]:
      label = f"LH-{code}"
      girls_hostels.append(
          {
              "name": label,
              "code": label,
              "description": f"Ladies Hostel {code}",
              "zone": ZoneCategory.RESIDENTIAL,
              "tags": "hostel,residential,24x7",
              "is_24x7": True,
              "water_threshold": 24000,
              "electricity_threshold": 7500,
          }
      )

  all_buildings = academic_common + boys_hostels + girls_hostels
  # Add campus name uniformly
  for b in all_buildings:
      b.setdefault("campus_name", campus)

  return all_buildings

