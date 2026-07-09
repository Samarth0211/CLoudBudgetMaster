"""
Local record of paid bill-audit orders for the no-signup, no-auth PAID
report flow (`backend/api/bill_audit.py`). Mirrors `payment_store.py`'s
shape/pattern (same lightweight local SQLite-on-the-VPS approach) but is
kept as its own store/table since these orders aren't tied to a user_id —
they're tied to an email + a single-use report token.

Lifecycle of a row:
  created  -> record_order() right after we create the PayPal order
  captured -> mark_captured() once PayPal confirms COMPLETED and the
              amount/currency match what we recorded (see bill_audit.py)
  used     -> mark_used() once the single-use token has been redeemed to
              generate + email the paid report (prevents replay)
"""
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "bill_audit_orders.db"


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS bill_audit_orders (
            order_id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            product TEXT NOT NULL,
            amount TEXT NOT NULL,
            currency TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'created',
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            captured_at TEXT,
            used_at TEXT
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bill_audit_orders_token ON bill_audit_orders(token)")
    return conn


def record_order(order_id: str, email: str, product: str, amount: str, currency: str, token: str) -> None:
    conn = _conn()
    conn.execute(
        """INSERT OR REPLACE INTO bill_audit_orders
           (order_id, email, product, amount, currency, token, status, used, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'created', 0, ?)""",
        (order_id, email, product, amount, currency, token, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def get_order(order_id: str) -> dict | None:
    conn = _conn()
    row = conn.execute(
        """SELECT order_id, email, product, amount, currency, token, status, used
           FROM bill_audit_orders WHERE order_id=?""",
        (order_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(zip(
        ["order_id", "email", "product", "amount", "currency", "token", "status", "used"], row
    ))


def get_order_by_token(token: str) -> dict | None:
    conn = _conn()
    row = conn.execute(
        """SELECT order_id, email, product, amount, currency, token, status, used
           FROM bill_audit_orders WHERE token=?""",
        (token,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(zip(
        ["order_id", "email", "product", "amount", "currency", "token", "status", "used"], row
    ))


def mark_captured(order_id: str) -> None:
    conn = _conn()
    conn.execute(
        "UPDATE bill_audit_orders SET status='captured', captured_at=? WHERE order_id=?",
        (datetime.now(timezone.utc).isoformat(), order_id),
    )
    conn.commit()
    conn.close()


def mark_used(token: str) -> None:
    conn = _conn()
    conn.execute(
        "UPDATE bill_audit_orders SET used=1, used_at=? WHERE token=?",
        (datetime.now(timezone.utc).isoformat(), token),
    )
    conn.commit()
    conn.close()


def claim_token(token: str) -> bool:
    """Atomically claim a single-use token: flips used 0 -> 1 in one UPDATE
    guarded by `AND used=0`, so two concurrent /paid-report calls with the
    same token can't both pass a separate check-then-act read/write. Returns
    True iff this call was the one that claimed it (rowcount == 1); False
    means it was already used/in-flight (or the token doesn't exist).
    """
    conn = _conn()
    cur = conn.execute(
        "UPDATE bill_audit_orders SET used=1, used_at=? WHERE token=? AND used=0",
        (datetime.now(timezone.utc).isoformat(), token),
    )
    claimed = cur.rowcount == 1
    conn.commit()
    conn.close()
    return claimed


def captured_orders() -> list[dict]:
    """All orders with status='captured' (real, PayPal-confirmed sales) — used by
    the founder ops-metrics endpoint (api/ops.py). Never includes 'created'
    (abandoned checkout) rows.
    """
    conn = _conn()
    rows = conn.execute(
        "SELECT order_id, email, product, amount, currency, captured_at FROM bill_audit_orders WHERE status='captured'"
    ).fetchall()
    conn.close()
    return [dict(zip(["order_id", "email", "product", "amount", "currency", "captured_at"], r)) for r in rows]


def revenue_by_product() -> dict[str, dict]:
    """Sum captured-order amounts grouped by product key, e.g. {'health-check': {'orders': 3, 'revenue_usd': 147.0}}.

    Uses the actual stored `amount` per order (real charged value), not a
    hardcoded price — so this stays correct even if PRODUCTS pricing changes
    over time and old orders were captured at a different price.
    """
    out: dict[str, dict] = {}
    for o in captured_orders():
        key = o["product"]
        bucket = out.setdefault(key, {"orders": 0, "revenue_usd": 0.0})
        bucket["orders"] += 1
        try:
            bucket["revenue_usd"] += float(o["amount"])
        except (TypeError, ValueError):
            pass
    return out


def release_token(token: str) -> None:
    """Undo a claim when report generation fails on bad input (parse/analyze
    error), so the buyer can retry with a corrected CSV without losing their
    paid, single-use token to their own upload mistake.
    """
    conn = _conn()
    conn.execute(
        "UPDATE bill_audit_orders SET used=0, used_at=NULL WHERE token=?",
        (token,),
    )
    conn.commit()
    conn.close()
