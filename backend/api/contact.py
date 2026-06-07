import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, constr
from backend.core.rate_limit import limiter

router = APIRouter(prefix="/contact", tags=["contact"])

# Stored locally on the VPS (no external DB). File lives next to the backend.
_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "contact.db"


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            company TEXT,
            message TEXT NOT NULL,
            handled INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )"""
    )
    return conn


class ContactRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1, max_length=120)
    email: EmailStr
    company: constr(strip_whitespace=True, max_length=160) = ""
    message: constr(strip_whitespace=True, min_length=5, max_length=4000)


@router.post("", status_code=201)
@limiter.limit("5/minute")
async def submit_contact(request: Request, body: ContactRequest):
    """Public endpoint — store a contact/demo request in local SQLite. No auth."""
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO contact_messages (name, email, company, message, created_at) VALUES (?, ?, ?, ?, ?)",
            (body.name, str(body.email), body.company or None, body.message, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()
    except Exception:
        raise HTTPException(status_code=500, detail="Could not submit your message right now. Please email us directly.")

    # Best-effort email notification — never fail the request if email is down.
    try:
        from backend.core.email_service import send_contact_notification
        send_contact_notification(body.name, str(body.email), body.company, body.message)
    except Exception:
        pass

    return {"status": "received"}
