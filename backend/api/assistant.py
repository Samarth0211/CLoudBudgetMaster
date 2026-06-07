from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from backend.db.client import get_db
from backend.dependencies import get_current_user
from backend.core.rate_limit import limiter

router = APIRouter(prefix="/assistant", tags=["assistant"])

CHAT_LIMITS = {"free": 3, "pro": 15, "enterprise": 50}


def _get_chat_usage(db, user_id: str) -> dict:
    """Get chat usage from profiles table (chat_count, chat_month columns)."""
    now = datetime.now(timezone.utc)
    month_key = now.strftime("%Y-%m")

    try:
        result = db.table("profiles").select("chat_count, chat_month").eq("id", user_id).single().execute()
        data = result.data or {}
        count = data.get("chat_count") or 0
        month = data.get("chat_month") or ""

        if month != month_key:
            # New month — reset counter
            db.table("profiles").update({"chat_count": 0, "chat_month": month_key}).eq("id", user_id).execute()
            return {"count": 0, "month": month_key}

        return {"count": count, "month": month_key}
    except Exception:
        # Columns might not exist yet — return 0
        return {"count": 0, "month": month_key}


def _increment_chat_usage(db, user_id: str, current_count: int, month_key: str):
    """Increment chat usage counter in profiles table."""
    try:
        db.table("profiles").update({
            "chat_count": current_count + 1,
            "chat_month": month_key,
        }).eq("id", user_id).execute()
    except Exception:
        pass  # If columns don't exist, silently fail


def _check_chat_limit(user):
    plan = user.get("plan", "free")
    limit = CHAT_LIMITS.get(plan, 3)
    db = get_db()

    usage = _get_chat_usage(db, user["id"])

    if usage["count"] >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Chat limit reached ({limit}/month on {plan} plan). Upgrade for more."
        )

    _increment_chat_usage(db, user["id"], usage["count"], usage["month"])
    return usage["count"] + 1, limit


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@router.get("/usage")
async def chat_usage(user=Depends(get_current_user)):
    """Return chat usage for the current month."""
    plan = user.get("plan", "free")
    limit = CHAT_LIMITS.get(plan, 3)
    db = get_db()
    usage = _get_chat_usage(db, user["id"])
    return {"used": usage["count"], "limit": limit, "plan": plan}


@router.post("/public-chat")
@limiter.limit("12/minute")
async def public_chat(request: Request, req: ChatRequest):
    """Public, no-login FinOps assistant for the landing page (rate-limited per IP)."""
    from backend.services.ai.public_chat import public_assistant
    msg = (req.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message is required")
    history = [{"role": m.role, "content": m.content} for m in req.history]
    return await public_assistant(msg[:1000], history)


@router.post("/chat")
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    """AI chat endpoint — sends user message with cloud context to Groq."""
    from backend.services.ai.chat import chat_with_ai

    used, limit = _check_chat_limit(user)

    db = get_db()

    # Gather user's cloud context for the AI
    conns = db.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    context = {
        "total_monthly_cost_usd": 0,
        "total_waste_cost_usd": 0,
        "total_resources": 0,
        "unused_resources": 0,
        "top_wasters": [],
    }

    if conn_ids:
        resources = db.table("resources") \
            .select("resource_name, resource_type, monthly_cost_usd, waste_monthly_cost_usd, waste_status, waste_reason") \
            .in_("connection_id", conn_ids) \
            .execute()

        for r in (resources.data or []):
            context["total_resources"] += 1
            context["total_monthly_cost_usd"] += r.get("monthly_cost_usd", 0) or 0
            context["total_waste_cost_usd"] += r.get("waste_monthly_cost_usd", 0) or 0
            if r.get("waste_status") in ("unused", "idle"):
                context["unused_resources"] += 1

        # Top wasters
        wasters = db.table("resources") \
            .select("resource_name, resource_type, waste_monthly_cost_usd, waste_reason") \
            .in_("connection_id", conn_ids) \
            .in_("waste_status", ["unused", "idle"]) \
            .order("waste_monthly_cost_usd", desc=True) \
            .limit(5) \
            .execute()
        context["top_wasters"] = wasters.data or []

    history = [{"role": m.role, "content": m.content} for m in req.history]
    result = await chat_with_ai(req.message, history, context)

    result["chat_usage"] = {"used": used, "limit": limit}
    return result
