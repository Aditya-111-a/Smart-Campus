# SmartCampus Utilities Dashboard

SmartCampus is a full-stack campus utilities platform for tracking water and electricity usage across buildings, analyzing trends, and managing alerts from one dashboard.
It includes authenticated operations for buildings/readings, CSV/XLSX ingestion, IoT device ingestion, analytics, reports, and role-based admin tools.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Run the App](#run-the-app)
- [Default Demo Accounts](#default-demo-accounts)
- [API Reference Map](#api-reference-map)
- [Usage Examples](#usage-examples)
- [Data Import and IoT Notes](#data-import-and-iot-notes)
- [Operational Endpoints](#operational-endpoints)
- [Troubleshooting](#troubleshooting)
- [Production Notes](#production-notes)

## Overview

This project is designed for campus utility monitoring use cases where teams need to:

- Track consumption per building
- Manage data from manual entry, uploaded files, and IoT devices
- Detect anomalies and threshold breaches
- Generate analytics and reporting summaries
- Enforce role-based access (`admin`, `user`)

## Architecture

SmartCampus follows a frontend-backend architecture:

1. React frontend (`frontend/`) provides authenticated dashboard workflows.
2. FastAPI backend (`backend/`) exposes REST APIs for auth, CRUD, analytics, reports, alerts, imports, and IoT.
3. SQLAlchemy models persist users, buildings, readings, alerts, rules, and IoT device mappings.
4. Vite dev server proxies frontend `/api/*` calls to backend `http://localhost:8000`.

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Pydantic, Uvicorn
- Database: SQLite by default (PostgreSQL supported)
- Frontend: React, Vite, Tailwind CSS, Recharts
- Auth: JWT bearer tokens with role-based authorization
- Data ingest: Pandas + OpenPyXL for CSV/XLSX import

## Project Structure

```text
SmartCampus/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── buildings.py
│   │   │   ├── readings.py
│   │   │   ├── analytics.py
│   │   │   ├── alerts.py
│   │   │   ├── reports.py
│   │   │   ├── admin_import.py
│   │   │   ├── iot.py
│   │   │   └── system.py
│   │   ├── anomaly_detection.py
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── ingestion.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── init_db.py
│   ├── seed_data.py
│   ├── main.py
│   ├── requirements.txt
│   └── run.sh
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   ├── vite.config.js
│   └── run.sh
├── run.sh
└── README.md
```

## Core Features

### Authentication and Authorization

- JWT login flow (`/api/auth/login`) and current-user profile (`/api/auth/me`)
- Role-based permissions:
  - `admin`: building/readings management, import, IoT device CRUD, alert rule CRUD
  - `user`: read dashboards/data and create readings

### Building and Reading Management

- Buildings CRUD with thresholds and campus metadata
- Building overview endpoint with trend percentages and period comparison
- Readings CRUD with filters by building, utility type, and date range

### Analytics and Reports

- Total consumption and rankings
- Daily/weekly/monthly time summaries
- Descriptive stats: mean, median, variance, std-dev
- Advanced insights: moving averages, cumulative sums, z-score anomalies
- Monthly/custom report generation with top consumers and alert counts

### Alerts and Rules

- System-generated alerts (spike, threshold breach, continuous high)
- Alert lifecycle operations: list, acknowledge, resolve
- Dynamic admin-defined alert rules with scope:
  - `global`
  - `zone`
  - `building`

### Import and IoT

- Admin import from CSV/XLSX with row-level error reporting
- IoT device registry (admin CRUD)
- IoT ingest endpoint supporting:
  - Global integration key (`X-API-Key`)
  - Per-device key (`X-Device-Key`)

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

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

## Configuration

Backend configuration is loaded from `backend/.env`.

| Variable | Default | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `sqlite:///./smartcampus.db` | Yes | If unset or left at the sample PostgreSQL placeholder, app falls back to SQLite. |
| `SECRET_KEY` | `your-secret-key-change-this-in-production` | Yes | Change this in non-demo environments. |
| `ALGORITHM` | `HS256` | Yes | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Yes | Token lifetime in minutes. |
| `DEBUG` | `True` | Yes | Enables debug behavior (including demo reset endpoint). |
| `IOT_API_KEY` | unset | No | Enables global IoT key authentication mode. |

Minimal local `.env` example:

```env
DATABASE_URL=sqlite:///./smartcampus.db
SECRET_KEY=change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DEBUG=True
# Optional for global IoT auth
# IOT_API_KEY=your-global-iot-key
```

## Run the App

### Option A: Run both frontend and backend from repo root

```bash
./run.sh
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

### Option B: Run services separately

Backend:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

## Default Demo Accounts

Created by `backend/seed_data.py`:

- Admin: `admin@campus.edu / admin123`
- User: `user@campus.edu / user123`

## API Reference Map

Base URL: `http://localhost:8000`

| Area | Prefix | Highlights |
|---|---|---|
| Auth | `/api/auth` | register, login, me |
| Buildings | `/api/buildings` | list, overview, CRUD |
| Readings | `/api/readings` | list with filters, CRUD |
| Analytics | `/api/analytics` | totals, rankings, summary, stats, insights |
| Reports | `/api/reports` | monthly and custom reports |
| Alerts | `/api/alerts` | alert lifecycle + rule CRUD |
| Admin Import | `/api/admin` | CSV/XLSX import, seed buildings, demo reset |
| IoT | `/api/iot` | device CRUD and ingest |
| System | `/api/system` | schema/auth/count diagnostics |

Public utility routes:

- `GET /` -> API greeting
- `GET /health` -> basic health

## Usage Examples

### Login and get JWT token

`/api/auth/login` uses form-encoded fields (`username`, `password`).

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@campus.edu&password=admin123"
```

### Call an authenticated endpoint

```bash
curl "http://localhost:8000/api/buildings" \
  -H "Authorization: Bearer <TOKEN>"
```

### Create a reading (authenticated)

```bash
curl -X POST "http://localhost:8000/api/readings" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "building_id": 1,
    "utility_type": "water",
    "value": 820.5,
    "reading_date": "2026-02-23T10:00:00Z",
    "notes": "Manual meter entry"
  }'
```

## Data Import and IoT Notes

### CSV/XLSX import format

Required columns (case-insensitive):

- `timestamp`
- `building`
- `utility` (`water` or `electricity`)
- `value`

Example CSV:

```csv
timestamp,building,utility,value
2026-02-22T08:00:00Z,TT Main Block,water,1500
2026-02-22T18:00:00Z,TT Main Block,electricity,620
```

Upload endpoint:

- `POST /api/admin/import-readings` (admin token required, multipart file upload)

### IoT ingest behavior

Endpoint: `POST /api/iot/ingest`

Supported auth headers:

- Global mode: `X-API-Key: <IOT_API_KEY>`
- Device mode: `X-Device-Key: <device_key>`

Payload:

```json
{
  "device_id": "sensor-001",
  "utility": "water",
  "value": 123.4,
  "timestamp": "2026-02-23T12:00:00Z",
  "building_code": "TTMB"
}
```

Important: IoT ingestion is blocked unless the target building has `iot_enabled=true`.

## Operational Endpoints

- `GET /health`: basic liveness
- `GET /api/system/health`: auth status, counts, and DB schema hash

Admin utility endpoints:

- `POST /api/admin/seed-buildings`: idempotent VIT building seed/update
- `POST /api/admin/reset-vit-demo`: drop/recreate DB and reseed demo data (only when `DEBUG=True`)

## Troubleshooting

### `No users exist in the database` on login

Run:

```bash
cd backend
source venv/bin/activate
python init_db.py
python seed_data.py
```

### Frontend loads but API requests fail

- Confirm backend is running at `http://localhost:8000`
- Confirm Vite proxy in `frontend/vite.config.js` still points to that URL
- Check backend logs for auth or validation errors

### IoT ingest returns `503 IoT ingestion is disabled for this building`

- Enable `iot_enabled` for that building via building update API/admin flow

### Database mismatch after model changes

- In local/dev, use `POST /api/admin/reset-vit-demo` (debug mode only)
- Or recreate DB manually with `init_db.py` + `seed_data.py`

## Production Notes

- Use PostgreSQL for production scale (`psycopg2-binary` available as optional dependency).
- Set a strong `SECRET_KEY` and reduce token lifetime from demo defaults.
- Set `DEBUG=False` to disable reset endpoint behavior.
- Restrict CORS origins in `backend/main.py` to trusted domains.
- Add proper migrations (e.g., Alembic) before production rollout.

