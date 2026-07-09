"""Ops metrics API: a single, no-login, token-gated endpoint so the founder can
check revenue + blog + user stats from a URL (no signin flow, no admin account).

Auth model is deliberately NOT the JWT/ADMIN_EMAILS scheme used elsewhere
(dependencies.require_admin) — this is meant to be opened from a phone with
zero setup. It is gated by a single secret ADMIN_TOKEN env var compared
against a `token` query param. If ADMIN_TOKEN is unset, the endpoint denies
ALL access rather than falling open.

Every section is wrapped independently so one failing query returns partial
data (with an "error" note) instead of 500ing the whole response — this is a
convenience dashboard, not a critical path, and partial visibility beats none.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.config import get_settings
from backend.db.client import get_db
from backend.core import bill_audit_store
from backend.core import payment_store
from backend.services.blog_render import reading_time

router = APIRouter(prefix="/ops", tags=["ops"])

# product key -> display label, shared with bill_audit.py's PRODUCTS keys
_PRODUCT_LABELS = {
    "health-check": "AWS Bill Health Check",
    "ai-audit": "AI / GPU Cost Audit",
    "networking": "Networking Teardown",
    "msp": "MSP White-Label Report",
}

_PRO_MONTHLY_USD = 29


def _check_token(token: str) -> None:
    admin_token = get_settings().admin_token
    if not admin_token or token != admin_token:
        raise HTTPException(status_code=403, detail="Forbidden")


def _iso(v):
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


def _revenue_section() -> dict:
    try:
        by_product_raw = bill_audit_store.revenue_by_product()
        by_product = [
            {
                "product": key,
                "label": _PRODUCT_LABELS.get(key, key),
                "orders": vals["orders"],
                "revenue_usd": round(vals["revenue_usd"], 2),
            }
            for key, vals in by_product_raw.items()
        ]
        one_time_total = round(sum(v["revenue_usd"] for v in by_product_raw.values()), 2)
    except Exception as e:  # noqa: BLE001 — never let one bad section 500 the endpoint
        by_product, one_time_total = [], 0.0
        by_product_error = str(e)[:300]
    else:
        by_product_error = None

    try:
        pro_count = payment_store.count_captured_plan("pro")
        pro = {"count": pro_count, "revenue_usd": pro_count * _PRO_MONTHLY_USD}
    except Exception as e:  # noqa: BLE001
        pro = {"count": 0, "revenue_usd": 0, "error": str(e)[:300]}

    out = {
        "total_usd": round(one_time_total + pro["revenue_usd"], 2),
        "one_time_total_usd": one_time_total,
        "by_product": by_product,
        "pro": pro,
    }
    if by_product_error:
        out["by_product_error"] = by_product_error
    return out


def _blog_section() -> dict:
    try:
        db = get_db()
        rows = db.table("blog_posts") \
            .select("title, slug, views, published_at, content") \
            .eq("status", "published").order("published_at", desc=True).execute().data or []
        posts = []
        for r in rows:
            content = r.pop("content", "") or ""
            try:
                rt = int(reading_time(content).split()[0])
            except (ValueError, IndexError):
                rt = 1
            posts.append({
                "title": r.get("title"),
                "slug": r.get("slug"),
                "views": r.get("views") or 0,
                "read_time": rt,
                "published_at": _iso(r.get("published_at")),
            })
        total_views = sum(p["views"] for p in posts)
        avg_read_time = round(sum(p["read_time"] for p in posts) / len(posts), 1) if posts else 0
        return {"total_views": total_views, "avg_read_time": avg_read_time, "posts": posts}
    except Exception as e:  # noqa: BLE001
        return {"total_views": 0, "avg_read_time": 0, "posts": [], "error": str(e)[:300]}


def _users_section() -> dict:
    try:
        db = get_db()
        rows = db.table("profiles").select("plan, plan_expires_at").execute().data or []
        by_plan: dict[str, int] = {}
        now = datetime.now(timezone.utc)
        on_trial = 0
        for r in rows:
            plan = r.get("plan") or "free"
            by_plan[plan] = by_plan.get(plan, 0) + 1
            exp = r.get("plan_expires_at")
            if exp:
                expd = exp if hasattr(exp, "tzinfo") else datetime.fromisoformat(str(exp))
                if expd.tzinfo is None:
                    expd = expd.replace(tzinfo=timezone.utc)
                if expd > now:
                    on_trial += 1
        return {"total": len(rows), "by_plan": by_plan, "on_trial": on_trial}
    except Exception as e:  # noqa: BLE001
        return {"total": 0, "by_plan": {}, "on_trial": 0, "error": str(e)[:300]}


def _waitlist_section() -> dict:
    try:
        db = get_db()
        count_res = db.table("waitlist").select("id", count="exact").execute()
        recent_rows = db.table("waitlist").select("email, product, created_at") \
            .order("created_at", desc=True).limit(20).execute().data or []
        recent = [
            {"email": r.get("email"), "product": r.get("product"), "created_at": _iso(r.get("created_at"))}
            for r in recent_rows
        ]
        return {"count": count_res.count or 0, "recent": recent}
    except Exception as e:  # noqa: BLE001
        return {"count": 0, "recent": [], "error": str(e)[:300]}


@router.get("/overview")
async def ops_overview(token: str = Query("")):
    """Single-shot founder metrics snapshot. No auth beyond the token query param."""
    _check_token(token)
    return {
        "revenue": _revenue_section(),
        "blog": _blog_section(),
        "users": _users_section(),
        "waitlist": _waitlist_section(),
    }
