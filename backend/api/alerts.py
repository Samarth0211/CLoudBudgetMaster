from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from backend.db.client import get_supabase
from backend.dependencies import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


# Map frontend rule types to DB-allowed values
RULE_TYPE_MAP = {
    "daily_cost_above": "budget_threshold",
    "daily_spike_percent": "cost_spike",
    "new_unused_resource": "unused_resource",
}
RULE_TYPE_REVERSE = {v: k for k, v in RULE_TYPE_MAP.items()}

RULE_TYPE_LABELS = {
    "budget_threshold": "Daily cost exceeds threshold",
    "cost_spike": "Cost spike detected",
    "unused_resource": "New unused resources detected",
    "new_resource": "New resource detected",
}


class AlertRuleCreate(BaseModel):
    rule_type: str  # daily_cost_above, daily_spike_percent, new_unused_resource
    threshold: float = 0
    email_enabled: bool = True


class AlertRuleUpdate(BaseModel):
    threshold: Optional[float] = None
    email_enabled: Optional[bool] = None
    enabled: Optional[bool] = None


def _enrich_rule(rule: dict) -> dict:
    """Add frontend-friendly fields to a rule from DB."""
    rule["threshold"] = rule.get("threshold_value", 0)
    rule["email_enabled"] = rule.get("notify_email", True)
    rule["enabled"] = rule.get("is_active", True)
    db_type = rule.get("rule_type", "")
    rule["label"] = RULE_TYPE_LABELS.get(db_type, db_type)
    rule["frontend_type"] = RULE_TYPE_REVERSE.get(db_type, db_type)
    return rule


def _enrich_event(event: dict) -> dict:
    """Add frontend-friendly fields to an event from DB."""
    event["created_at"] = event.get("triggered_at", "")
    event["dismissed"] = event.get("acknowledged", False)
    details = event.get("details") or {}
    event["severity"] = details.get("severity", "warning")
    event["current_value"] = details.get("current_value", 0)
    event["rule_type"] = details.get("rule_type", "")
    return event


@router.get("/rules")
async def list_rules(user=Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("alert_rules") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .execute()
    return {"rules": [_enrich_rule(r) for r in (result.data or [])]}


@router.post("/rules")
async def create_rule(req: AlertRuleCreate, user=Depends(get_current_user)):
    supabase = get_supabase()

    # Check plan limits
    from backend.config import get_settings
    settings = get_settings()
    plan = user.get("plan", "free")
    limits = settings.plan_limits.get(plan, settings.plan_limits["free"])
    max_rules = limits.get("max_alert_rules", 3)

    existing = supabase.table("alert_rules") \
        .select("id", count="exact") \
        .eq("user_id", user["id"]) \
        .execute()

    if (existing.count or 0) >= max_rules:
        raise HTTPException(
            status_code=403,
            detail=f"Alert rule limit reached ({max_rules} on {plan} plan). Upgrade for more."
        )

    # Map frontend type to DB type
    db_rule_type = RULE_TYPE_MAP.get(req.rule_type)
    if not db_rule_type:
        raise HTTPException(status_code=400, detail=f"Invalid rule type: {req.rule_type}")

    # Get user's first connection (connection_id is required FK in DB schema)
    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .limit(1) \
        .execute()

    connection_id = conns.data[0]["id"] if conns.data else None
    if not connection_id:
        raise HTTPException(
            status_code=400,
            detail="You need at least one cloud connection before creating alert rules. Go to Connections to add one."
        )

    result = supabase.table("alert_rules").insert({
        "user_id": user["id"],
        "connection_id": connection_id,
        "rule_type": db_rule_type,
        "threshold_value": req.threshold,
        "notify_email": req.email_enabled,
        "is_active": True,
    }).execute()

    if result.data:
        return _enrich_rule(result.data[0])
    raise HTTPException(status_code=500, detail="Failed to create rule")


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: str, req: AlertRuleUpdate, user=Depends(get_current_user)):
    supabase = get_supabase()

    existing = supabase.table("alert_rules") \
        .select("id") \
        .eq("id", rule_id) \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    updates = {}
    if req.threshold is not None:
        updates["threshold_value"] = req.threshold
    if req.email_enabled is not None:
        updates["notify_email"] = req.email_enabled
    if req.enabled is not None:
        updates["is_active"] = req.enabled

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("alert_rules") \
        .update(updates) \
        .eq("id", rule_id) \
        .execute()

    if result.data:
        return _enrich_rule(result.data[0])
    return {}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()

    existing = supabase.table("alert_rules") \
        .select("id") \
        .eq("id", rule_id) \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    supabase.table("alert_rules").delete().eq("id", rule_id).execute()
    return {"deleted": True}


@router.get("/events")
async def list_events(
    user=Depends(get_current_user),
    dismissed: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    supabase = get_supabase()
    query = supabase.table("alert_events") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("triggered_at", desc=True) \
        .limit(limit)

    if dismissed is not None:
        query = query.eq("acknowledged", dismissed)

    result = query.execute()
    return {"events": [_enrich_event(e) for e in (result.data or [])]}


@router.post("/events/{event_id}/dismiss")
async def dismiss_event(event_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()

    supabase.table("alert_events") \
        .update({"acknowledged": True}) \
        .eq("id", event_id) \
        .eq("user_id", user["id"]) \
        .execute()

    return {"dismissed": True}


@router.post("/events/dismiss-all")
async def dismiss_all(user=Depends(get_current_user)):
    supabase = get_supabase()

    supabase.table("alert_events") \
        .update({"acknowledged": True}) \
        .eq("user_id", user["id"]) \
        .eq("acknowledged", False) \
        .execute()

    return {"dismissed_all": True}
