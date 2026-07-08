"""Admin API: account overview for internal/ops use only.

Gated by require_admin (ADMIN_EMAILS allowlist) — never scoped to a single
user_id since the whole point is admins seeing everyone. Only ever select
the columns we intend to expose; password_hash must never leave this file.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from backend.db.client import get_db
from backend.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

_PROFILE_COLS = "id, email, full_name, plan, plan_expires_at, promo_code, email_verified, created_at"


def _iso(v):
    """Coerce a DB timestamp value (datetime, string, or None) to an ISO string."""
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


@router.get("/users")
async def list_users(admin=Depends(require_admin)):
    db = get_db()
    profiles = db.table("profiles").select(_PROFILE_COLS).order("created_at", desc=True).execute().data or []

    conns = db.table("cloud_connections").select("user_id").execute().data or []
    conn_counts: dict[str, int] = {}
    for c in conns:
        uid = c.get("user_id")
        if uid:
            conn_counts[uid] = conn_counts.get(uid, 0) + 1

    now = datetime.now(timezone.utc)
    users = []
    paid_users = 0
    on_trial = 0

    for p in profiles:
        plan = p.get("plan") or "free"
        expires_at = _iso(p.get("plan_expires_at"))

        if plan != "free":
            paid_users += 1

        if expires_at:
            expd = p["plan_expires_at"] if hasattr(p["plan_expires_at"], "tzinfo") else datetime.fromisoformat(expires_at)
            if expd.tzinfo is None:
                expd = expd.replace(tzinfo=timezone.utc)
            if expd > now:
                on_trial += 1

        users.append({
            "id": p.get("id"),
            "email": p.get("email"),
            "full_name": p.get("full_name"),
            "plan": plan,
            "plan_expires_at": expires_at,
            "promo_code": p.get("promo_code"),
            "email_verified": bool(p.get("email_verified")),
            "created_at": _iso(p.get("created_at")),
            "connection_count": conn_counts.get(p.get("id"), 0),
        })

    return {
        "users": users,
        "total": len(users),
        "stats": {
            "total_users": len(users),
            "paid_users": paid_users,
            "on_trial": on_trial,
            "total_connections": len(conns),
        },
    }
