from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.db.client import get_supabase
from backend.dependencies import get_current_user

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@router.post("/chat")
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    """AI chat endpoint — sends user message with cloud context to Groq."""
    from backend.services.ai.chat import chat_with_ai

    supabase = get_supabase()

    # Gather user's cloud context for the AI
    conns = supabase.table("cloud_connections") \
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
        resources = supabase.table("resources") \
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
        wasters = supabase.table("resources") \
            .select("resource_name, resource_type, waste_monthly_cost_usd, waste_reason") \
            .in_("connection_id", conn_ids) \
            .in_("waste_status", ["unused", "idle"]) \
            .order("waste_monthly_cost_usd", desc=True) \
            .limit(5) \
            .execute()
        context["top_wasters"] = wasters.data or []

    history = [{"role": m.role, "content": m.content} for m in req.history]
    result = await chat_with_ai(req.message, history, context)

    return result
