from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from backend.db.client import get_supabase
from backend.dependencies import get_current_user
from backend.core.encryption import encrypt_credentials, decrypt_credentials
from backend.models.connection import (
    CreateConnectionRequest, ConnectionResponse,
    ConnectionListResponse, ConnectionStatusResponse,
)
from backend.config import get_settings

router = APIRouter(prefix="/connections", tags=["connections"])

VALID_PROVIDERS = {"aws", "gcp", "azure", "snowflake"}


@router.get("", response_model=ConnectionListResponse)
async def list_connections(user=Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("cloud_connections") \
        .select("id, provider, display_name, status, last_scanned_at, error_message, created_at") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .execute()

    connections = [ConnectionResponse(**c) for c in (result.data or [])]
    return ConnectionListResponse(connections=connections, count=len(connections))


@router.post("", response_model=ConnectionResponse, status_code=201)
async def create_connection(body: CreateConnectionRequest, user=Depends(get_current_user)):
    if body.provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {', '.join(VALID_PROVIDERS)}")

    # Check plan limits
    settings = get_settings()
    plan = user.get("plan", "free")
    max_connections = settings.plan_limits.get(plan, {}).get("max_connections", 1)

    supabase = get_supabase()
    existing = supabase.table("cloud_connections") \
        .select("id", count="exact") \
        .eq("user_id", user["id"]) \
        .execute()
    current_count = existing.count or 0

    if current_count >= max_connections:
        raise HTTPException(
            status_code=403,
            detail=f"{plan.capitalize()} plan allows {max_connections} cloud connection(s). Upgrade to add more.",
        )

    # Encrypt credentials
    encrypted = encrypt_credentials(body.credentials)

    row = {
        "user_id": user["id"],
        "provider": body.provider,
        "display_name": body.display_name,
        "credentials_encrypted": encrypted,
        "status": "active",
    }

    result = supabase.table("cloud_connections").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create connection")

    conn = result.data[0]
    return ConnectionResponse(
        id=conn["id"],
        provider=conn["provider"],
        display_name=conn["display_name"],
        status=conn["status"],
        last_scanned_at=conn.get("last_scanned_at"),
        error_message=conn.get("error_message"),
        created_at=conn["created_at"],
    )


@router.delete("/{connection_id}")
async def delete_connection(connection_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()

    # Verify ownership
    conn = supabase.table("cloud_connections") \
        .select("id") \
        .eq("id", connection_id) \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()

    if not conn.data:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Delete related data first (ignore errors for tables that may not exist yet)
    for table in ["resources", "cost_snapshots", "alert_rules"]:
        try:
            supabase.table(table).delete().eq("connection_id", connection_id).execute()
        except Exception:
            pass
    supabase.table("cloud_connections").delete().eq("id", connection_id).execute()

    return {"message": "Connection deleted", "id": connection_id}


@router.post("/{connection_id}/scan")
async def trigger_scan(connection_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()

    conn = supabase.table("cloud_connections") \
        .select("*") \
        .eq("id", connection_id) \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()

    if not conn.data:
        raise HTTPException(status_code=404, detail="Connection not found")

    if conn.data.get("status") == "scanning":
        raise HTTPException(status_code=429, detail="Scan already in progress")

    # Mark as scanning
    supabase.table("cloud_connections") \
        .update({"status": "scanning"}) \
        .eq("id", connection_id) \
        .execute()

    # Run scan (inline for now, background worker in production)
    try:
        from backend.core.scanner_runner import run_scan
        credentials = decrypt_credentials(conn.data["credentials_encrypted"])
        await run_scan(connection_id, conn.data["provider"], credentials, user["id"])

        supabase.table("cloud_connections") \
            .update({"status": "active", "last_scanned_at": datetime.now(timezone.utc).isoformat(), "error_message": None}) \
            .eq("id", connection_id) \
            .execute()
    except Exception as e:
        supabase.table("cloud_connections") \
            .update({"status": "error", "error_message": str(e)[:500]}) \
            .eq("id", connection_id) \
            .execute()
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)[:200]}")

    return {"message": "Scan completed", "connection_id": connection_id, "status": "active"}


@router.get("/{connection_id}/status", response_model=ConnectionStatusResponse)
async def connection_status(connection_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()

    conn = supabase.table("cloud_connections") \
        .select("id, provider, display_name, status, last_scanned_at, error_message") \
        .eq("id", connection_id) \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()

    if not conn.data:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Get resource stats
    resources = supabase.table("resources") \
        .select("monthly_cost_usd, waste_monthly_cost_usd", count="exact") \
        .eq("connection_id", connection_id) \
        .execute()

    resource_count = resources.count or 0
    total_cost = sum(r.get("monthly_cost_usd", 0) or 0 for r in (resources.data or []))
    waste_cost = sum(r.get("waste_monthly_cost_usd", 0) or 0 for r in (resources.data or []))

    return ConnectionStatusResponse(
        **conn.data,
        resource_count=resource_count,
        total_monthly_cost_usd=round(total_cost, 2),
        waste_monthly_cost_usd=round(waste_cost, 2),
    )
