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
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_mode: str = "sandbox"  # "sandbox" or "live"
    credential_encryption_key: str
    frontend_url: str = "http://localhost:5173"
    environment: str = "development"

    # Plan limits
    plan_limits: dict = {
        "free": {"max_connections": 1, "max_alert_rules": 3, "scan_frequency": "daily"},
        "pro": {"max_connections": 5, "max_alert_rules": 50, "scan_frequency": "hourly"},
        "enterprise": {"max_connections": 999, "max_alert_rules": 999, "scan_frequency": "hourly"},
    }

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
