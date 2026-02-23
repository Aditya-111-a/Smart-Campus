from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    database_url: str = "sqlite:///./smartcampus.db"
    secret_key: str = "your-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    debug: bool = True
    # Optional API key for IoT ingestion
    iot_api_key: Optional[str] = None

    class Config:
        env_file = ".env"
        # Allow reading from environment variables
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Use SQLite if DATABASE_URL is not set or if it's the default PostgreSQL URL
        # Check self.database_url (loaded by Pydantic from .env) instead of os.getenv
        # because Pydantic loads from .env without updating os.environ
        if not self.database_url or self.database_url.startswith("postgresql://postgres:postgres"):
            self.database_url = "sqlite:///./smartcampus.db"

settings = Settings()
