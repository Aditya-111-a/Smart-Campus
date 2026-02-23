# SmartCampus Utilities Dashboard

SmartCampus is a full-stack campus utilities platform for monitoring water/electricity usage, ingesting readings (manual, CSV, IoT), generating analytics, and managing alerts.

## Stack

- Backend: FastAPI + SQLAlchemy + SQLite (PostgreSQL optional)
- Frontend: React + Vite + Tailwind + Recharts
- Auth: JWT (role-based: `admin`, `user`)

## Current Features

- Authentication (`/api/auth/login`, `/api/auth/me`)
- Buildings management (admin create/edit/delete)
- Readings management (admin create/edit/delete)
- Manual Entry flow with existing-building selection + "Others" option
- CSV/XLSX import with row-level error reporting
- Reports (monthly + custom date range)
- Analytics with scope filters:
  - Overall
  - Category/Zone
  - Particular Building(s)
  - Mean/median/variance/std-dev, cumulative sums, moving average, z-score anomalies
- Alerts:
  - Standard anomaly alerts (threshold, spike, continuous high)
  - Dynamic admin-configured alert rules (global/zone/building)
- IoT integration:
  - Device registry (admin CRUD)
  - Ingestion endpoint for real-time readings

## Project Structure

```text
SmartCampus/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── anomaly_detection.py
│   │   └── ingestion.py
│   ├── main.py
│   ├── init_db.py
│   ├── seed_data.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── contexts/
│   │   └── services/
│   └── package.json
└── run.sh
```

## Quick Start

### 1) Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python init_db.py
python seed_data.py
```

### 2) Frontend setup

```bash
cd frontend
npm install
```

### 3) Run

From repo root:

```bash
./run.sh
```

Or run separately:

- Backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
- Frontend: `cd frontend && npm run dev`

## Access

- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

Default users (after seed):

- Admin: `admin@campus.edu / admin123`
- User: `user@campus.edu / user123`

## Required Environment Variables

In `backend/.env`:

```env
DATABASE_URL=sqlite:///./smartcampus.db
SECRET_KEY=change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DEBUG=True
```

Optional (IoT global key mode):

```env
IOT_API_KEY=your-global-iot-key
```

## Main API Areas

- Auth: `/api/auth/*`
- Buildings: `/api/buildings*`
- Readings: `/api/readings*`
- Analytics: `/api/analytics/*`
- Reports: `/api/reports/*`
- Alerts + Rules: `/api/alerts*`
- IoT Devices + Ingest: `/api/iot/*`
- Admin import/seed/reset: `/api/admin/*`

## Notes

- CSV/XLSX import supports `timestamp,building,utility,value` columns.
- IoT ingest supports either:
  - `X-API-Key` (global key) + `building_code`, or
  - `X-Device-Key` (device key) using registered device mapping.
- Dynamic alert rules are admin-managed from the Alerts page.
