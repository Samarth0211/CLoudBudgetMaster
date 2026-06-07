from fastapi import APIRouter, Depends, Query, Path
from typing import Optional
from backend.db.client import get_db
from backend.dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(
    connection_id: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    db = get_db()

    # Get user's connections
    conn_query = db.table("cloud_connections") \
        .select("id, provider") \
        .eq("user_id", user["id"])
    if connection_id:
        conn_query = conn_query.eq("id", connection_id)
    if provider:
        conn_query = conn_query.eq("provider", provider)
    conns = conn_query.execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {
            "total_monthly_cost_usd": 0, "total_waste_cost_usd": 0,
            "waste_percentage": 0, "total_resources": 0, "unused_resources": 0,
            "cost_change_wow_percent": 0, "cost_change_wow_usd": 0,
            "breakdown_by_provider": [],
        }

    # Get resources for those connections
    resources = db.table("resources") \
        .select("provider, monthly_cost_usd, waste_monthly_cost_usd, waste_status, connection_id") \
        .in_("connection_id", conn_ids) \
        .execute()

    total_cost = 0.0
    total_waste = 0.0
    total_resources = 0
    unused_resources = 0
    by_provider = {}

    for r in (resources.data or []):
        prov = r["provider"]
        cost = r.get("monthly_cost_usd", 0) or 0
        waste = r.get("waste_monthly_cost_usd", 0) or 0
        is_unused = r.get("waste_status") in ("unused", "idle")

        total_cost += cost
        total_waste += waste
        total_resources += 1
        if is_unused:
            unused_resources += 1

        if prov not in by_provider:
            by_provider[prov] = {"provider": prov, "monthly_cost_usd": 0, "waste_cost_usd": 0,
                                  "resource_count": 0, "unused_resource_count": 0}
        by_provider[prov]["monthly_cost_usd"] += cost
        by_provider[prov]["waste_cost_usd"] += waste
        by_provider[prov]["resource_count"] += 1
        if is_unused:
            by_provider[prov]["unused_resource_count"] += 1

    # Round provider values
    for p in by_provider.values():
        p["monthly_cost_usd"] = round(p["monthly_cost_usd"], 2)
        p["waste_cost_usd"] = round(p["waste_cost_usd"], 2)

    # Cost trend WoW from cost_snapshots
    wow_percent, wow_usd = _calc_wow_change(db, conn_ids)

    waste_pct = round((total_waste / total_cost * 100), 2) if total_cost > 0 else 0

    return {
        "total_monthly_cost_usd": round(total_cost, 2),
        "total_waste_cost_usd": round(total_waste, 2),
        "waste_percentage": waste_pct,
        "total_resources": total_resources,
        "unused_resources": unused_resources,
        "cost_change_wow_percent": wow_percent,
        "cost_change_wow_usd": wow_usd,
        "breakdown_by_provider": list(by_provider.values()),
    }


@router.get("/trend")
async def dashboard_trend(
    connection_id: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=90),
    user=Depends(get_current_user),
):
    db = get_db()

    # Get user's connection IDs
    conn_query = db.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"])
    if connection_id:
        conn_query = conn_query.eq("id", connection_id)
    if provider:
        conn_query = conn_query.eq("provider", provider)
    conns = conn_query.execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {"data_points": [], "period_start": None, "period_end": None}

    # Get cost snapshots
    snapshots = db.table("cost_snapshots") \
        .select("snapshot_date, total_cost_usd") \
        .in_("connection_id", conn_ids) \
        .order("snapshot_date") \
        .execute()

    # Aggregate by date (multiple connections can have same date)
    by_date = {}
    for s in (snapshots.data or []):
        date = s["snapshot_date"]
        by_date[date] = by_date.get(date, 0) + (s.get("total_cost_usd", 0) or 0)

    data_points = [{"date": d, "total_cost_usd": round(c, 2)} for d, c in sorted(by_date.items())]

    # Trim to requested days
    data_points = data_points[-days:]

    return {
        "data_points": data_points,
        "period_start": data_points[0]["date"] if data_points else None,
        "period_end": data_points[-1]["date"] if data_points else None,
    }


@router.get("/top-waste")
async def top_waste(
    connection_id: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    user=Depends(get_current_user),
):
    db = get_db()

    conn_query = db.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"])
    if connection_id:
        conn_query = conn_query.eq("id", connection_id)
    if provider:
        conn_query = conn_query.eq("provider", provider)
    conns = conn_query.execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {"resources": [], "total_waste_cost_usd": 0}

    resources = db.table("resources") \
        .select("*") \
        .in_("connection_id", conn_ids) \
        .in_("waste_status", ["unused", "idle"]) \
        .order("waste_monthly_cost_usd", desc=True) \
        .limit(limit) \
        .execute()

    total_waste = sum(r.get("waste_monthly_cost_usd", 0) or 0 for r in (resources.data or []))

    return {
        "resources": resources.data or [],
        "total_waste_cost_usd": round(total_waste, 2),
    }


@router.get("/day/{date}")
async def day_breakdown(
    date: str = Path(..., description="Date in YYYY-MM-DD format"),
    user=Depends(get_current_user),
):
    """Return per-service cost breakdown for a specific day, plus previous day for comparison."""
    db = get_db()

    conns = db.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {"date": date, "services": [], "total": 0, "previous_day_total": 0}

    # Get snapshots for this date
    snapshots = db.table("cost_snapshots") \
        .select("raw_breakdown, total_cost_usd") \
        .in_("connection_id", conn_ids) \
        .eq("snapshot_date", date) \
        .execute()

    # Merge breakdowns across connections
    merged = {}
    total = 0.0
    for s in (snapshots.data or []):
        total += s.get("total_cost_usd", 0) or 0
        breakdown = s.get("raw_breakdown") or {}
        for svc, cost in breakdown.items():
            merged[svc] = merged.get(svc, 0) + (cost or 0)

    # Get previous day for comparison
    from datetime import datetime, timedelta
    try:
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    except ValueError:
        prev_date = None

    prev_total = 0.0
    prev_merged = {}
    if prev_date:
        prev_snaps = db.table("cost_snapshots") \
            .select("raw_breakdown, total_cost_usd") \
            .in_("connection_id", conn_ids) \
            .eq("snapshot_date", prev_date) \
            .execute()
        for s in (prev_snaps.data or []):
            prev_total += s.get("total_cost_usd", 0) or 0
            breakdown = s.get("raw_breakdown") or {}
            for svc, cost in breakdown.items():
                prev_merged[svc] = prev_merged.get(svc, 0) + (cost or 0)

    # Build service list sorted by cost desc
    services = []
    for svc, cost in sorted(merged.items(), key=lambda x: x[1], reverse=True):
        if cost <= 0:
            continue
        prev_cost = prev_merged.get(svc, 0)
        services.append({
            "service": svc,
            "cost": round(cost, 2),
            "percent": round(cost / total * 100, 1) if total > 0 else 0,
            "previous_cost": round(prev_cost, 2),
            "change": round(cost - prev_cost, 2),
        })

    return {
        "date": date,
        "services": services,
        "total": round(total, 2),
        "previous_day_total": round(prev_total, 2),
    }


@router.get("/forecast")
async def cost_forecast(
    user=Depends(get_current_user),
):
    """Simple linear regression forecast based on last 30 days of cost data."""
    db = get_db()

    conns = db.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {"current_monthly": 0, "projected_monthly": 0, "trend_direction": "flat", "daily_projections": []}

    snapshots = db.table("cost_snapshots") \
        .select("snapshot_date, total_cost_usd") \
        .in_("connection_id", conn_ids) \
        .order("snapshot_date") \
        .execute()

    # Aggregate by date
    by_date = {}
    for s in (snapshots.data or []):
        date = s["snapshot_date"]
        by_date[date] = by_date.get(date, 0) + (s.get("total_cost_usd", 0) or 0)

    sorted_dates = sorted(by_date.items())[-30:]  # last 30 days

    if len(sorted_dates) < 3:
        current = sum(v for _, v in sorted_dates)
        return {"current_monthly": round(current, 2), "projected_monthly": round(current, 2), "trend_direction": "flat", "daily_projections": []}

    # Simple linear regression: y = mx + b
    n = len(sorted_dates)
    x_vals = list(range(n))
    y_vals = [v for _, v in sorted_dates]

    x_mean = sum(x_vals) / n
    y_mean = sum(y_vals) / n

    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, y_vals))
    den = sum((x - x_mean) ** 2 for x in x_vals)

    slope = num / den if den != 0 else 0
    intercept = y_mean - slope * x_mean

    # Project next 30 days
    from datetime import datetime, timedelta
    last_date = datetime.strptime(sorted_dates[-1][0], "%Y-%m-%d")
    projections = []
    for i in range(1, 31):
        proj_date = (last_date + timedelta(days=i)).strftime("%Y-%m-%d")
        proj_cost = max(0, intercept + slope * (n - 1 + i))
        projections.append({"date": proj_date, "projected_cost_usd": round(proj_cost, 2)})

    current_monthly = sum(y_vals)
    projected_monthly = sum(p["projected_cost_usd"] for p in projections)

    if slope > 0.5:
        trend = "increasing"
    elif slope < -0.5:
        trend = "decreasing"
    else:
        trend = "flat"

    return {
        "current_monthly": round(current_monthly, 2),
        "projected_monthly": round(projected_monthly, 2),
        "trend_direction": trend,
        "daily_projections": projections,
        "daily_change": round(slope, 2),
    }


@router.get("/cost-by-tag")
async def cost_by_tag(
    tag_key: str = Query("Environment"),
    user=Depends(get_current_user),
):
    """Group resources by a tag key and sum costs."""
    db = get_db()

    conns = db.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {"tag_key": tag_key, "groups": [], "available_tags": []}

    resources = db.table("resources") \
        .select("monthly_cost_usd, metadata") \
        .in_("connection_id", conn_ids) \
        .execute()

    groups = {}
    all_tag_keys = set()

    for r in (resources.data or []):
        tags = (r.get("metadata") or {}).get("tags") or {}
        for k in tags:
            all_tag_keys.add(k)

        tag_value = tags.get(tag_key, "Untagged")
        cost = r.get("monthly_cost_usd", 0) or 0

        if tag_value not in groups:
            groups[tag_value] = {"tag_value": tag_value, "resource_count": 0, "total_cost": 0}
        groups[tag_value]["resource_count"] += 1
        groups[tag_value]["total_cost"] += cost

    # Sort by cost desc
    sorted_groups = sorted(groups.values(), key=lambda g: g["total_cost"], reverse=True)
    for g in sorted_groups:
        g["total_cost"] = round(g["total_cost"], 2)

    return {
        "tag_key": tag_key,
        "groups": sorted_groups,
        "available_tags": sorted(all_tag_keys),
    }


def _calc_wow_change(db, conn_ids: list) -> tuple[float, float]:
    """Calculate week-over-week cost change from cost_snapshots."""
    try:
        from datetime import datetime, timedelta
        today = datetime.utcnow().date()
        week_ago = (today - timedelta(days=7)).isoformat()
        two_weeks_ago = (today - timedelta(days=14)).isoformat()

        this_week = db.table("cost_snapshots") \
            .select("total_cost_usd") \
            .in_("connection_id", conn_ids) \
            .gte("snapshot_date", week_ago) \
            .execute()

        last_week = db.table("cost_snapshots") \
            .select("total_cost_usd") \
            .in_("connection_id", conn_ids) \
            .gte("snapshot_date", two_weeks_ago) \
            .lt("snapshot_date", week_ago) \
            .execute()

        this_total = sum(s.get("total_cost_usd", 0) or 0 for s in (this_week.data or []))
        last_total = sum(s.get("total_cost_usd", 0) or 0 for s in (last_week.data or []))

        if last_total > 0:
            pct = round((this_total - last_total) / last_total * 100, 1)
            usd = round(this_total - last_total, 2)
            return pct, usd
    except Exception:
        pass

    return 0.0, 0.0
