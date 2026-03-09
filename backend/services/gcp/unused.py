"""GCP Unused Resource Detection — find idle VMs, unattached disks, idle Cloud SQL."""


async def detect_unused_gcp_resources(credentials: dict) -> list:
    """
    Detect unused/idle GCP resources.

    Checks:
    - Stopped Compute Engine VMs
    - Unattached Persistent Disks
    - Idle Cloud SQL instances (no connections)

    Returns list of resource dicts ready for DB upsert.
    """
    try:
        from google.cloud import compute_v1
        from google.cloud import sqladmin_v1
        from google.oauth2 import service_account
    except ImportError:
        raise NotImplementedError(
            "GCP scanning requires google-cloud-compute and google-cloud-sql-admin packages. "
            "Install with: pip install google-cloud-compute google-cloud-sql-admin"
        )

    project_id = credentials.get("project_id")
    sa_json = credentials.get("service_account_json")

    if not project_id or not sa_json:
        raise ValueError("Missing project_id or service_account_json")

    creds = service_account.Credentials.from_service_account_info(
        sa_json,
        scopes=["https://www.googleapis.com/auth/cloud-platform.read-only"],
    )

    resources = []

    # 1. Detect stopped VMs
    try:
        instances_client = compute_v1.InstancesClient(credentials=creds)
        agg_list = instances_client.aggregated_list(project=project_id)

        for zone, response in agg_list:
            if not response.instances:
                continue
            for vm in response.instances:
                if vm.status == "TERMINATED":
                    resources.append({
                        "resource_id": str(vm.id),
                        "resource_name": vm.name,
                        "resource_type": "gce_instance",
                        "status": "stopped",
                        "region": zone.split("/")[-1],
                        "waste_status": "unused",
                        "waste_reason": f"VM '{vm.name}' is stopped but still incurring disk costs",
                        "monthly_cost_usd": 0,  # Would need billing data to estimate
                        "waste_monthly_cost_usd": 0,
                        "metadata": {
                            "machine_type": vm.machine_type.split("/")[-1] if vm.machine_type else None,
                            "creation_timestamp": vm.creation_timestamp,
                        },
                    })
    except Exception as e:
        print(f"[GCP] Failed to scan VMs: {e}")

    # 2. Detect unattached disks
    try:
        disks_client = compute_v1.DisksClient(credentials=creds)
        agg_list = disks_client.aggregated_list(project=project_id)

        for zone, response in agg_list:
            if not response.disks:
                continue
            for disk in response.disks:
                if not disk.users:  # No VMs attached
                    size_gb = disk.size_gb or 0
                    # Standard persistent disk: ~$0.04/GB/month
                    est_cost = size_gb * 0.04
                    resources.append({
                        "resource_id": str(disk.id),
                        "resource_name": disk.name,
                        "resource_type": "gce_disk",
                        "status": "unattached",
                        "region": zone.split("/")[-1],
                        "waste_status": "unused",
                        "waste_reason": f"Disk '{disk.name}' ({size_gb}GB) is not attached to any VM",
                        "monthly_cost_usd": round(est_cost, 2),
                        "waste_monthly_cost_usd": round(est_cost, 2),
                        "metadata": {
                            "size_gb": size_gb,
                            "disk_type": disk.type_.split("/")[-1] if disk.type_ else None,
                            "creation_timestamp": disk.creation_timestamp,
                        },
                    })
    except Exception as e:
        print(f"[GCP] Failed to scan disks: {e}")

    # 3. Detect idle Cloud SQL instances
    try:
        sql_client = sqladmin_v1.SqlInstancesServiceClient(credentials=creds)
        instances = sql_client.list(project=project_id)

        for instance in instances.items or []:
            if instance.state == "STOPPED" or instance.state == "SUSPENDED":
                resources.append({
                    "resource_id": instance.name,
                    "resource_name": instance.name,
                    "resource_type": "cloudsql_instance",
                    "status": instance.state.lower(),
                    "region": instance.region,
                    "waste_status": "unused",
                    "waste_reason": f"Cloud SQL instance '{instance.name}' is {instance.state.lower()}",
                    "monthly_cost_usd": 0,
                    "waste_monthly_cost_usd": 0,
                    "metadata": {
                        "database_version": instance.database_version,
                        "tier": instance.settings.tier if instance.settings else None,
                    },
                })
    except Exception as e:
        print(f"[GCP] Failed to scan Cloud SQL: {e}")

    return resources
