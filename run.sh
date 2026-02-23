#!/bin/bash

# SmartCampus - Run backend and frontend (no dependency install)
# Prerequisites: run backend and frontend setup once (venv, pip install, npm install)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

cleanup() {
  echo ""
  echo "Stopping servers..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
  exit 0
}
trap cleanup SIGINT SIGTERM

# Backend: ensure .env and DB exist (no pip install)
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
  cp .env.example .env
fi
if [ ! -f "smartcampus.db" ] && [ ! -f "../smartcampus.db" ]; then
  source venv/bin/activate 2>/dev/null || { echo "Backend venv not found. Run: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"; exit 1; }
  python init_db.py
  python seed_data.py
fi

source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."
wait
