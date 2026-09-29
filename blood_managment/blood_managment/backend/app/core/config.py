from functools import lru_cache
import json
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings and configuration.
    
    Reads from environment variables and a local .env file.
    Required variables do not have default values and will raise an error if missing,
    ensuring secrets are never hardcoded or bypassed.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Core Application Configuration
    APP_NAME: str = "Blood Donation Management API"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    AUTO_CREATE_TABLES: bool = False

    # CORS Configuration
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://blood-donation-management-prince-8dae.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        """
        Allows CORS_ORIGINS to be provided in the .env file as a comma-separated string
        (e.g., CORS_ORIGINS="http://localhost:3000,https://production.com") or as a JSON list.
        """
        if isinstance(v, str):
            if v.lstrip().startswith("["):
                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database Configuration
    DATABASE_URL: str

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Notification Configuration
    NOTIFICATION_DRY_RUN: bool = True
    SMS_PROVIDER: str | None = None
    SMS_API_KEY: str | None = None
    EMAIL_FROM: str | None = None


@lru_cache
def get_settings() -> Settings:
    """
    Instantiates and caches the Settings object.
    Using lru_cache ensures the .env file is read only once during application startup,
    providing a safe and performant singleton instance.
    """
    return Settings()


# Export a single global instance to be used across the application
settings = get_settings()
