from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    resend_api_key: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    credential_encryption_key: str
    frontend_url: str = "http://localhost:5173"
    environment: str = "development"

    # Plan limits
    plan_limits: dict = {
        "free": {"max_connections": 1, "max_alert_rules": 3, "scan_frequency": "weekly"},
        "starter": {"max_connections": 3, "max_alert_rules": 10, "scan_frequency": "daily"},
        "growth": {"max_connections": 10, "max_alert_rules": 50, "scan_frequency": "daily"},
        "team": {"max_connections": 25, "max_alert_rules": 100, "scan_frequency": "hourly"},
    }

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
