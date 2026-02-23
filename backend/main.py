from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import (
    auth,
    buildings,
    readings,
    analytics,
    alerts,
    reports,
    admin_import,
    iot,
    system,
)

logger = logging.getLogger("smartcampus")


# Create database tables (startup only – see schema health endpoint for drift checks)
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="SmartCampus Utilities Dashboard API",
    description="API for monitoring water and electricity usage across campus",
    version="1.0.0",
    lifespan=lifespan,
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_debug_middleware(request: Request, call_next):
    """
    Temporary debug middleware: logs Authorization header presence and path.
    """
    auth_header = request.headers.get("Authorization", "")
    has_auth = bool(auth_header)
    token_prefix = ""
    if auth_header.startswith("Bearer "):
        token_value = auth_header.split(" ", 1)[1]
        token_prefix = token_value[:16]

    logger.info(
        "[REQ] incoming request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "has_auth": has_auth,
            "auth_scheme": auth_header.split(" ", 1)[0] if has_auth else None,
            "token_prefix": token_prefix,
        },
    )

    response = await call_next(request)

    logger.info(
        "[RES] outgoing response",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
        },
    )

    return response


# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(buildings.router, prefix="/api/buildings", tags=["Buildings"])
app.include_router(readings.router, prefix="/api/readings", tags=["Readings"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(admin_import.router, prefix="/api/admin", tags=["Admin"])
app.include_router(iot.router, prefix="/api/iot", tags=["IoT"])
app.include_router(system.router, prefix="/api/system", tags=["System"])


@app.get("/")
async def root():
    return {"message": "SmartCampus Utilities Dashboard API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
