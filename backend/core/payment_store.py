"""
Local record of PayPal orders we created, so capture can be verified against the
user + expected amount (instead of trusting any COMPLETED order id). Stored in
local SQLite on the VPS, like the other lightweight stores.
"""
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "payments.db"


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS payment_orders (
            order_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            plan TEXT NOT NULL,
            amount TEXT NOT NULL,
            currency TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'created',
            created_at TEXT NOT NULL,
            captured_at TEXT
        )"""
    )
    return conn


def record_order(order_id: str, user_id: str, plan: str, amount: str, currency: str) -> None:
    conn = _conn()
    conn.execute(
        """INSERT OR REPLACE INTO payment_orders
           (order_id, user_id, plan, amount, currency, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'created', ?)""",
        (order_id, user_id, plan, amount, currency, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def get_order(order_id: str) -> dict | None:
    conn = _conn()
    row = conn.execute(
        "SELECT order_id, user_id, plan, amount, currency, status FROM payment_orders WHERE order_id=?",
        (order_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(zip(["order_id", "user_id", "plan", "amount", "currency", "status"], row))


def mark_captured(order_id: str) -> None:
    conn = _conn()
    conn.execute(
        "UPDATE payment_orders SET status='captured', captured_at=? WHERE order_id=?",
        (datetime.now(timezone.utc).isoformat(), order_id),
    )
    conn.commit()
    conn.close()
