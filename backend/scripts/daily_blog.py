"""Cron entrypoint: write + publish today's blog post and email subscribers.

Run daily at 08:00 IST (02:30 UTC) from the server crontab:
  30 2 * * * cd /var/www/cloudbudgetmaster && backend/venv/bin/python -m backend.scripts.daily_blog >> /var/log/cbm_daily_blog.log 2>&1
"""
from datetime import datetime, timezone

from backend.db.client import get_db
from backend.services.daily_blog import run_daily


def main():
    stamp = datetime.now(timezone.utc).isoformat()
    try:
        result = run_daily(get_db())
        print(f"[{stamp}] daily_blog: {result}")
    except Exception as e:  # noqa: BLE001
        print(f"[{stamp}] daily_blog ERROR: {e}")
        raise


if __name__ == "__main__":
    main()
