"""
Short-lived auth codes (email verification + password reset) stored in local
SQLite on the VPS — NOT in process memory. This fixes two problems with the old
in-memory dicts:
  1. Brute-force: each code is attempt-limited (MAX_ATTEMPTS) and expires, so a
     6-digit code can't be guessed (5 tries out of 900k, then it's killed).
  2. Multi-worker / restarts: a shared file works across gunicorn workers and
     survives restarts (an in-memory dict did neither).

Codes are stored as an HMAC (keyed by the app's encryption key), never plaintext.
"""
import sqlite3
import hmac
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from backend.config import get_settings

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "auth.db"
MAX_ATTEMPTS = 5
TTL_MINUTES = 10


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS auth_codes (
            email TEXT NOT NULL,
            purpose TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            PRIMARY KEY (email, purpose)
        )"""
    )
    return conn


def _hash(email: str, code: str) -> str:
    key = get_settings().credential_encryption_key.encode()
    return hmac.new(key, f"{email.lower()}:{code.strip()}".encode(), hashlib.sha256).hexdigest()


def set_code(email: str, purpose: str, code: str) -> None:
    """Store (or replace) a code for (email, purpose). Resets the attempt count."""
    email = email.lower()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=TTL_MINUTES)).isoformat()
    conn = _conn()
    conn.execute(
        """INSERT INTO auth_codes (email, purpose, code_hash, expires_at, attempts)
           VALUES (?, ?, ?, ?, 0)
           ON CONFLICT(email, purpose) DO UPDATE SET
             code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0""",
        (email, purpose, _hash(email, code), expires),
    )
    conn.commit()
    conn.close()


def verify_code(email: str, purpose: str, code: str) -> tuple[bool, str | None]:
    """
    Check a code. Returns (ok, error_message). On success the code is consumed.
    Wrong guesses increment attempts; the code is invalidated at MAX_ATTEMPTS or
    after expiry.
    """
    email = email.lower()
    conn = _conn()
    row = conn.execute(
        "SELECT code_hash, expires_at, attempts FROM auth_codes WHERE email=? AND purpose=?",
        (email, purpose),
    ).fetchone()

    if not row:
        conn.close()
        return False, "No pending code. Please request a new one."

    code_hash, expires_at, attempts = row

    if datetime.now(timezone.utc) > datetime.fromisoformat(expires_at):
        conn.execute("DELETE FROM auth_codes WHERE email=? AND purpose=?", (email, purpose))
        conn.commit()
        conn.close()
        return False, "Code expired. Please request a new one."

    if attempts >= MAX_ATTEMPTS:
        conn.execute("DELETE FROM auth_codes WHERE email=? AND purpose=?", (email, purpose))
        conn.commit()
        conn.close()
        return False, "Too many incorrect attempts. Please request a new code."

    if not hmac.compare_digest(code_hash, _hash(email, code)):
        conn.execute("UPDATE auth_codes SET attempts = attempts + 1 WHERE email=? AND purpose=?", (email, purpose))
        conn.commit()
        conn.close()
        return False, "Invalid code."

    # Correct — consume it so it can't be reused.
    conn.execute("DELETE FROM auth_codes WHERE email=? AND purpose=?", (email, purpose))
    conn.commit()
    conn.close()
    return True, None
