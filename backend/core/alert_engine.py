from datetime import datetime, timedelta
from backend.db.client import get_supabase
from backend.core.email_service import send_alert_email


async def evaluate_alerts(user_id: str):
    """Check all alert rules for a user and fire events if triggered."""
    supabase = get_supabase()

    # Get user's active alert rules (uses DB column names)
    rules = supabase.table("alert_rules") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("is_active", True) \
        .execute()

    if not rules.data:
        return []

    # Get user's connections
    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user_id) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return []

    triggered = []

    for rule in rules.data:
        rule_type = rule["rule_type"]  # DB values: budget_threshold, cost_spike, unused_resource
        threshold = rule.get("threshold_value", 0) or 0

        event = None

        if rule_type == "budget_threshold":
            event = await _check_daily_cost(supabase, conn_ids, threshold)
        elif rule_type == "cost_spike":
            event = await _check_spike(supabase, conn_ids, threshold)
        elif rule_type == "unused_resource":
            event = await _check_new_unused(supabase, conn_ids)

        if event:
            # Create alert event using DB schema columns
            alert_event = supabase.table("alert_events").insert({
                "user_id": user_id,
                "rule_id": rule["id"],
                "message": event["message"],
                "details": {
                    "severity": event.get("severity", "warning"),
                    "current_value": event.get("current_value", 0),
                    "threshold": threshold,
                    "rule_type": rule_type,
                },
                "acknowledged": False,
            }).execute()

            # Send email if enabled
            if rule.get("notify_email"):
                profile = supabase.table("profiles").select("email").eq("id", user_id).single().execute()
                if profile.data and profile.data.get("email"):
                    await send_alert_email(profile.data["email"], {
                        "rule_type": rule_type,
                        "threshold": threshold,
                        "current_value": event.get("current_value", 0),
                        "message": event["message"],
                    })

            triggered.append(alert_event.data)

    return triggered


async def _check_daily_cost(supabase, conn_ids: list, threshold: float) -> dict | None:
    """Check if today's cost exceeds threshold."""
    today = datetime.utcnow().date().isoformat()

    snaps = supabase.table("cost_snapshots") \
        .select("total_cost_usd") \
        .in_("connection_id", conn_ids) \
        .eq("snapshot_date", today) \
        .execute()

    total = sum(s.get("total_cost_usd", 0) or 0 for s in (snaps.data or []))

    if total > threshold:
        return {
            "message": f"Daily cost ${total:.2f} exceeded your ${threshold:.2f} threshold",
            "current_value": total,
            "severity": "critical" if total > threshold * 1.5 else "warning",
        }
    return None


async def _check_spike(supabase, conn_ids: list, threshold_pct: float) -> dict | None:
    """Check if today's cost spiked vs yesterday by more than threshold%."""
    today = datetime.utcnow().date()
    yesterday = (today - timedelta(days=1)).isoformat()
    today_str = today.isoformat()

    today_snaps = supabase.table("cost_snapshots") \
        .select("total_cost_usd") \
        .in_("connection_id", conn_ids) \
        .eq("snapshot_date", today_str) \
        .execute()

    yest_snaps = supabase.table("cost_snapshots") \
        .select("total_cost_usd") \
        .in_("connection_id", conn_ids) \
        .eq("snapshot_date", yesterday) \
        .execute()

    today_total = sum(s.get("total_cost_usd", 0) or 0 for s in (today_snaps.data or []))
    yest_total = sum(s.get("total_cost_usd", 0) or 0 for s in (yest_snaps.data or []))

    if yest_total > 0:
        pct_change = ((today_total - yest_total) / yest_total) * 100
        if pct_change > threshold_pct:
            return {
                "message": f"Cost spiked {pct_change:.1f}% vs yesterday (${yest_total:.2f} -> ${today_total:.2f})",
                "current_value": pct_change,
                "severity": "critical" if pct_change > threshold_pct * 2 else "warning",
            }
    return None


async def _check_new_unused(supabase, conn_ids: list) -> dict | None:
    """Check if there are new unused resources detected in last 24 hours."""
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    new_unused = supabase.table("resources") \
        .select("id, resource_name, waste_monthly_cost_usd") \
        .in_("connection_id", conn_ids) \
        .in_("waste_status", ["unused", "idle"]) \
        .gte("last_seen_at", since) \
        .execute()

    if new_unused.data and len(new_unused.data) > 0:
        total_waste = sum(r.get("waste_monthly_cost_usd", 0) or 0 for r in new_unused.data)
        return {
            "message": f"{len(new_unused.data)} new unused resources detected, wasting ${total_waste:.2f}/mo",
            "current_value": total_waste,
            "severity": "warning",
        }
    return None
