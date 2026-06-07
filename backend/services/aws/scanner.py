import boto3
from backend.services.aws.cost_explorer import get_aws_daily_costs
from backend.services.aws.unused import (
    detect_stopped_ec2, detect_idle_ec2, detect_unattached_ebs,
    detect_idle_rds, detect_unassociated_eips,
)


def _get_active_regions(access_key: str, secret_key: str) -> list[str]:
    """Get all AWS regions enabled for this account."""
    ec2 = boto3.client(
        "ec2",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="us-east-1",
    )
    response = ec2.describe_regions(
        Filters=[{"Name": "opt-in-status", "Values": ["opt-in-not-required", "opted-in"]}]
    )
    return [r["RegionName"] for r in response.get("Regions", [])]


async def scan_aws(connection_id: str, credentials: dict, user_id: str, db):
    """Run full AWS scan: cost data + resource detection across ALL regions."""
    access_key = credentials["access_key_id"]
    secret_key = credentials["secret_access_key"]

    # 1. Fetch cost data (30 days) — Cost Explorer is global (always us-east-1)
    cost_data = get_aws_daily_costs(access_key, secret_key, lookback_days=30)

    # Store cost snapshots
    for day in cost_data["results_by_date"]:
        db.table("cost_snapshots").upsert({
            "connection_id": connection_id,
            "user_id": user_id,
            "snapshot_date": day["date"],
            "total_cost_usd": day["total_usd"],
            "raw_breakdown": day["by_service"],
        }, on_conflict="connection_id,snapshot_date").execute()

    # 2. Discover all enabled regions
    regions = _get_active_regions(access_key, secret_key)
    print(f"[scan_aws] Scanning {len(regions)} regions: {regions}")

    # 3. Scan all regions for resources
    all_resources = []

    detectors = [
        ("stopped_ec2", detect_stopped_ec2),
        ("idle_ec2", detect_idle_ec2),
        ("unattached_ebs", detect_unattached_ebs),
        ("idle_rds", detect_idle_rds),
        ("unassociated_eips", detect_unassociated_eips),
    ]

    for region in regions:
        for name, detector in detectors:
            try:
                resources = detector(access_key, secret_key, region)
                all_resources.extend(resources)
            except Exception as e:
                # Log but don't fail entire scan for one detector/region
                print(f"[scan_aws] {name} in {region} failed: {e}")

    # 4. Store resources — clear old, insert new
    db.table("resources").delete().eq("connection_id", connection_id).execute()

    for resource in all_resources:
        db.table("resources").insert({
            "connection_id": connection_id,
            "user_id": user_id,
            "provider": "aws",
            "resource_type": resource["resource_type"],
            "resource_id": resource["resource_id"],
            "resource_name": resource["resource_name"],
            "region": resource["region"],
            "status": resource["status"],
            "monthly_cost_usd": resource["monthly_cost_usd"],
            "waste_status": resource["waste_status"],
            "waste_reason": resource["waste_reason"],
            "waste_monthly_cost_usd": resource["waste_monthly_cost_usd"],
            "metadata": resource.get("metadata", {}),
        }).execute()

    print(f"[scan_aws] Done. {len(all_resources)} resources found across {len(regions)} regions.")

    return {
        "cost_days": len(cost_data["results_by_date"]),
        "total_cost_30d": cost_data["total_usd"],
        "resources_found": len(all_resources),
        "regions_scanned": len(regions),
    }
