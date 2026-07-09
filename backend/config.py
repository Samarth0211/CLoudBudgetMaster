from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    # Self-hosted PostgreSQL + JWT auth
    database_url: str = ""
    jwt_secret: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    # Open-source model for AI report narratives. Defaults to GPT-OSS-120B on
    # Groq's free tier (Groq does not currently serve Kimi). To use the actual
    # Kimi K2, point report_ai_base_url/report_ai_api_key at a provider that
    # hosts it (e.g. OpenRouter "moonshotai/kimi-k2:free") and set this model id.
    groq_report_model: str = "openai/gpt-oss-120b"
    report_ai_base_url: str = ""   # empty -> Groq; any OpenAI-compatible /chat/completions URL
    report_ai_api_key: str = ""    # empty -> reuse groq_api_key
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    contact_notify_email: str = ""  # where contact-form submissions are emailed (defaults to smtp_user)
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_mode: str = "sandbox"  # "sandbox" or "live"
    credential_encryption_key: str
    frontend_url: str = "http://localhost:5173"
    environment: str = "development"

    # Ops metrics (no-login, token-gated founder dashboard — see api/ops.py)
    admin_token: str = ""  # secret query-param token; unset => endpoint denies all access

    # Blog / SEO
    admin_emails: str = ""  # comma-separated emails allowed to manage blog posts
    site_url: str = "https://cloudbudgetmaster.com"  # canonical public origin (no trailing slash)
    blog_dist_dir: str = ""  # where to write static blog HTML (the nginx-served dist/); empty = skip file gen
    # Search-engine auto-ping on publish
    indexnow_key: str = ""  # IndexNow key (Bing/Yandex). A <key>.txt is served at the site root.
    google_indexing_sa_file: str = ""  # path to a Google service-account JSON to enable the Indexing API ping

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
