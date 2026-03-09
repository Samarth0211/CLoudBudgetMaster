from fastapi import APIRouter, HTTPException, Depends, Query
from backend.db.client import get_supabase
from backend.dependencies import get_current_user

router = APIRouter(prefix="/resources", tags=["resources"])

# Fix recommendations per waste type
FIX_STEPS = {
    ("ec2_instance", "idle"): {
        "summary": "Downsize or terminate this idle EC2 instance",
        "steps": [
            "Verify the instance is truly unused — check with your team if anyone relies on it",
            "If not needed: Go to EC2 Console → Select instance → Instance State → Terminate",
            "If still needed but idle: Right-click → Instance Settings → Change Instance Type → pick a smaller size (e.g. t3.micro)",
            "Create an AMI backup first if you want to restore later: Actions → Image → Create Image",
            "Consider using Auto Scaling or scheduling to stop during off-hours",
        ],
        "aws_console_path": "https://console.aws.amazon.com/ec2/v2/home#Instances",
    },
    ("ec2_instance", "unused"): {
        "summary": "Terminate this stopped EC2 instance or snapshot its volumes",
        "steps": [
            "This instance is stopped but you're still paying for its attached EBS volumes",
            "If not needed: Terminate the instance — this deletes attached EBS volumes (unless DeleteOnTermination=false)",
            "If you might need it later: Create an AMI (Actions → Image → Create Image), then terminate — you can relaunch from the AMI anytime",
            "To stop paying immediately: Terminate the instance and delete any remaining unattached volumes",
        ],
        "aws_console_path": "https://console.aws.amazon.com/ec2/v2/home#Instances",
    },
    ("ebs_volume", "unused"): {
        "summary": "Delete this unattached EBS volume or create a snapshot",
        "steps": [
            "This volume is not attached to any instance — likely left over from a terminated instance",
            "If not needed: EC2 Console → Volumes → Select → Actions → Delete Volume",
            "If you might need the data: Create a snapshot first (Actions → Create Snapshot), then delete the volume — snapshots cost ~$0.05/GB/mo vs $0.08-0.125/GB/mo for volumes",
            "Check the volume's 'Created' date and tags to identify what it was used for",
        ],
        "aws_console_path": "https://console.aws.amazon.com/ec2/v2/home#Volumes",
    },
    ("rds_instance", "unused"): {
        "summary": "Delete or stop this idle RDS instance",
        "steps": [
            "This database has had zero connections for 7+ days",
            "Confirm with your team that no application depends on it (check connection strings in your code/config)",
            "If not needed: RDS Console → Select DB → Actions → Delete (create a final snapshot when prompted)",
            "If needed occasionally: Actions → Stop temporarily (auto-restarts after 7 days — re-stop or delete)",
            "For dev/test databases: Consider using Aurora Serverless v2 which scales to zero",
        ],
        "aws_console_path": "https://console.aws.amazon.com/rds/home#databases",
    },
    ("elastic_ip", "unused"): {
        "summary": "Release this unassociated Elastic IP",
        "steps": [
            "This Elastic IP is not attached to any running instance — AWS charges $3.65/mo for idle EIPs since Feb 2024",
            "If not needed: EC2 Console → Elastic IPs → Select → Actions → Release Elastic IP address",
            "If needed: Associate it to a running instance (Actions → Associate Elastic IP address)",
            "Note: Once released, you cannot get the same IP back",
        ],
        "aws_console_path": "https://console.aws.amazon.com/ec2/v2/home#Addresses",
    },
}


def _get_fix(resource_type: str, waste_status: str) -> dict:
    return FIX_STEPS.get((resource_type, waste_status), {
        "summary": "Review this resource and consider removing it if unused",
        "steps": ["Check if this resource is actively used by any service", "If not needed, delete it to save costs"],
        "aws_console_path": "https://console.aws.amazon.com",
    })


@router.get("")
async def list_resources(
    user=Depends(get_current_user),
    provider: str = Query(None),
    waste_status: str = Query(None),
    resource_type: str = Query(None),
    connection_id: str = Query(None),
    search: str = Query(None),
    sort_by: str = Query("waste_monthly_cost_usd"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    supabase = get_supabase()

    # Get user's connection IDs
    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    if not conn_ids:
        return {"resources": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}

    query = supabase.table("resources") \
        .select("*", count="exact") \
        .in_("connection_id", conn_ids)

    if provider:
        query = query.eq("provider", provider)
    if waste_status:
        query = query.eq("waste_status", waste_status)
    if resource_type:
        query = query.eq("resource_type", resource_type)
    if connection_id:
        query = query.eq("connection_id", connection_id)
    if search:
        query = query.or_(f"resource_name.ilike.%{search}%,resource_id.ilike.%{search}%")

    # Sorting
    valid_sort_fields = {"waste_monthly_cost_usd", "monthly_cost_usd", "resource_name", "resource_type", "created_at"}
    if sort_by not in valid_sort_fields:
        sort_by = "waste_monthly_cost_usd"
    query = query.order(sort_by, desc=(sort_order == "desc"))

    # Pagination
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()
    total = result.count or 0

    # Attach fix recommendations (only for wasteful resources)
    resources = []
    for r in (result.data or []):
        if r.get("waste_status") and r["waste_status"] != "active":
            r["fix_recommendation"] = _get_fix(r["resource_type"], r["waste_status"])
        else:
            r["fix_recommendation"] = None
        resources.append(r)

    return {
        "resources": resources,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{resource_id}")
async def get_resource(resource_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()

    # Verify ownership via connection
    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    resource = supabase.table("resources") \
        .select("*") \
        .eq("id", resource_id) \
        .in_("connection_id", conn_ids) \
        .single() \
        .execute()

    if not resource.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    r = resource.data
    if r.get("waste_status") and r["waste_status"] != "active":
        r["fix_recommendation"] = _get_fix(r["resource_type"], r["waste_status"])
    else:
        r["fix_recommendation"] = None
    return r


@router.get("/{resource_id}/timeline")
async def resource_timeline(resource_id: str, user=Depends(get_current_user)):
    """Get historical snapshots for a resource (for timeline chart)."""
    supabase = get_supabase()

    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    resource = supabase.table("resources") \
        .select("id") \
        .eq("id", resource_id) \
        .in_("connection_id", conn_ids) \
        .single() \
        .execute()

    if not resource.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    snapshots = supabase.table("resource_snapshots") \
        .select("status, metrics, snapshot_date") \
        .eq("resource_id", resource_id) \
        .order("snapshot_date") \
        .limit(90) \
        .execute()

    return {"snapshots": snapshots.data or []}


@router.get("/{resource_id}/fix-commands")
async def get_fix_commands(resource_id: str, user=Depends(get_current_user)):
    """Get AWS CLI and Terraform fix commands for a wasteful resource."""
    from backend.services.ai.fix_commands import generate_fix_commands

    supabase = get_supabase()

    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    resource = supabase.table("resources") \
        .select("*") \
        .eq("id", resource_id) \
        .in_("connection_id", conn_ids) \
        .single() \
        .execute()

    if not resource.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    return generate_fix_commands(resource.data)


@router.post("/{resource_id}/recommendation")
async def get_ai_recommendation(resource_id: str, user=Depends(get_current_user)):
    """Generate AI-powered recommendation for a wasteful resource."""
    from backend.services.ai.recommendations import generate_recommendation

    supabase = get_supabase()

    # Verify ownership
    conns = supabase.table("cloud_connections") \
        .select("id") \
        .eq("user_id", user["id"]) \
        .execute()
    conn_ids = [c["id"] for c in (conns.data or [])]

    resource = supabase.table("resources") \
        .select("*") \
        .eq("id", resource_id) \
        .in_("connection_id", conn_ids) \
        .single() \
        .execute()

    if not resource.data:
        raise HTTPException(status_code=404, detail="Resource not found")

    r = resource.data

    # Return cached AI recommendation if available
    meta = r.get("metadata") or {}
    if meta.get("ai_recommendation"):
        return meta["ai_recommendation"]

    # Generate new recommendation
    ai_rec = await generate_recommendation(r)
    if not ai_rec:
        # Fallback to static steps
        fix = _get_fix(r["resource_type"], r.get("waste_status", ""))
        return {**fix, "ai_generated": False}

    # Cache in metadata
    meta["ai_recommendation"] = ai_rec
    supabase.table("resources") \
        .update({"metadata": meta}) \
        .eq("id", resource_id) \
        .execute()

    return ai_rec
