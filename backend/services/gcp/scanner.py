"""GCP Scanner — discovers resources and detects waste."""
from backend.db.client import get_db
from backend.services.gcp.billing import get_gcp_costs
from backend.services.gcp.unused import detect_unused_gcp_resources


async def scan_gcp(connection_id: str, credentials: dict, user_id: str, db=None):
    """Orchestrate a full GCP scan: billing + resource discovery + waste detection."""
    if db is None:
        db = get_db()

    # Update connection status
    db.table("cloud_connections") \
        .update({"status": "scanning"}) \
        .eq("id", connection_id) \
        .execute()

    results = {"resources_found": 0, "costs_fetched": False, "errors": []}

    try:
        # 1. Fetch billing data
        try:
            cost_data = await get_gcp_costs(credentials)
            if cost_data:
                # Store cost snapshot
                db.table("cost_snapshots").insert({
                    "connection_id": connection_id,
                    "snapshot_date": cost_data["date"],
                    "total_cost_usd": cost_data["total"],
                    "raw_breakdown": cost_data["breakdown"],
                }).execute()
                results["costs_fetched"] = True
        except Exception as e:
            results["errors"].append(f"Billing: {str(e)[:200]}")

        # 2. Detect unused resources
        try:
            unused = await detect_unused_gcp_resources(credentials)
            for resource in unused:
                resource["connection_id"] = connection_id
                resource["user_id"] = user_id
                resource["provider"] = "gcp"

                # Upsert resource
                db.table("resources").upsert(
                    resource,
                    on_conflict="connection_id,resource_id"
                ).execute()
                results["resources_found"] += 1
        except Exception as e:
            results["errors"].append(f"Resources: {str(e)[:200]}")

        # Update connection status
        from datetime import datetime
        db.table("cloud_connections") \
            .update({
                "status": "active",
                "last_scanned_at": datetime.utcnow().isoformat(),
                "error_message": None,
            }) \
            .eq("id", connection_id) \
            .execute()

    except Exception as e:
        db.table("cloud_connections") \
            .update({
                "status": "error",
                "error_message": str(e)[:500],
            }) \
            .eq("id", connection_id) \
            .execute()
        raise

    return results
