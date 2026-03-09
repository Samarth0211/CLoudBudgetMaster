import boto3
from datetime import datetime, timedelta

# Cost estimates per resource type
EBS_COST_PER_GB = {"gp3": 0.08, "gp2": 0.10, "io1": 0.125, "io2": 0.125, "st1": 0.045, "sc1": 0.015, "standard": 0.05}
EIP_MONTHLY_COST = 3.65


def _lookup_instance_creator(cloudtrail, instance_id: str, tags: dict) -> str | None:
    """Look up who launched an EC2 instance. Tries tags first, then CloudTrail."""
    # 1. Check common owner tags (always available, no 90-day limit)
    for tag_key in ["Owner", "owner", "CreatedBy", "created_by", "aws:createdBy", "User", "user"]:
        if tag_key in tags:
            return tags[tag_key]

    # 2. Fall back to CloudTrail events (only last 90 days)
    try:
        response = cloudtrail.lookup_events(
            LookupAttributes=[{"AttributeKey": "ResourceName", "AttributeValue": instance_id}],
            MaxResults=50,
        )
        # Prefer RunInstances event, but fall back to any event with a username
        fallback_username = None
        for event in response.get("Events", []):
            username = event.get("Username")
            if not username:
                continue
            if event.get("EventName") == "RunInstances":
                return username
            if fallback_username is None:
                fallback_username = username
        if fallback_username:
            return fallback_username
    except Exception as e:
        print(f"[CloudTrail] Failed to look up creator for {instance_id}: {e}")

    # 3. For EKS/auto-scaling managed instances, show the cluster or ASG name
    eks_cluster = tags.get("eks:cluster-name") or tags.get("aws:eks:cluster-name")
    if eks_cluster:
        return f"EKS:{eks_cluster}"
    asg = tags.get("aws:autoscaling:groupName")
    if asg:
        return f"ASG:{asg}"

    return None


def detect_stopped_ec2(access_key_id: str, secret_access_key: str, region: str):
    """Find EC2 instances stopped for >7 days."""
    ec2 = boto3.client("ec2", aws_access_key_id=access_key_id,
                        aws_secret_access_key=secret_access_key, region_name=region)
    cw = boto3.client("cloudwatch", aws_access_key_id=access_key_id,
                       aws_secret_access_key=secret_access_key, region_name=region)
    ct = boto3.client("cloudtrail", aws_access_key_id=access_key_id,
                       aws_secret_access_key=secret_access_key, region_name=region)

    instances = ec2.describe_instances(Filters=[{"Name": "instance-state-name", "Values": ["stopped"]}])
    results = []

    for reservation in instances.get("Reservations", []):
        for inst in reservation.get("Instances", []):
            instance_id = inst["InstanceId"]
            instance_type = inst.get("InstanceType", "unknown")
            name = _get_tag(inst.get("Tags", []), "Name") or instance_id

            # Check if stopped >7 days via CloudWatch (no CPU data = stopped)
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=7)
            metrics = cw.get_metric_statistics(
                Namespace="AWS/EC2", MetricName="CPUUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=start_time, EndTime=end_time,
                Period=86400, Statistics=["Average"],
            )

            if not metrics.get("Datapoints"):
                # Estimate cost from attached EBS volumes
                volumes = ec2.describe_volumes(Filters=[{"Name": "attachment.instance-id", "Values": [instance_id]}])
                ebs_cost = sum(
                    v.get("Size", 0) * EBS_COST_PER_GB.get(v.get("VolumeType", "gp3"), 0.08)
                    for v in volumes.get("Volumes", [])
                )

                created_by = _lookup_instance_creator(ct, instance_id, _tags_to_dict(inst.get("Tags", [])))

                results.append({
                    "resource_type": "ec2_instance",
                    "resource_id": instance_id,
                    "resource_name": name,
                    "region": region,
                    "status": "stopped",
                    "monthly_cost_usd": round(ebs_cost, 2),
                    "waste_status": "unused",
                    "waste_reason": "Stopped for 7+ days (still paying for EBS)",
                    "waste_monthly_cost_usd": round(ebs_cost, 2),
                    "metadata": {
                        "instance_type": instance_type,
                        "created_by": created_by,
                        "key_name": inst.get("KeyName"),
                        "launch_time": inst.get("LaunchTime").isoformat() if inst.get("LaunchTime") else None,
                        "platform": inst.get("PlatformDetails", "Linux/UNIX"),
                        "private_ip": inst.get("PrivateIpAddress"),
                        "public_ip": inst.get("PublicIpAddress"),
                        "tags": _tags_to_dict(inst.get("Tags", [])),
                    },
                })

    return results


def detect_idle_ec2(access_key_id: str, secret_access_key: str, region: str):
    """Scan ALL running EC2 instances — flag idle ones (<2% CPU), include active ones too."""
    ec2 = boto3.client("ec2", aws_access_key_id=access_key_id,
                        aws_secret_access_key=secret_access_key, region_name=region)
    cw = boto3.client("cloudwatch", aws_access_key_id=access_key_id,
                       aws_secret_access_key=secret_access_key, region_name=region)
    ct = boto3.client("cloudtrail", aws_access_key_id=access_key_id,
                       aws_secret_access_key=secret_access_key, region_name=region)

    instances = ec2.describe_instances(Filters=[{"Name": "instance-state-name", "Values": ["running"]}])
    results = []

    for reservation in instances.get("Reservations", []):
        for inst in reservation.get("Instances", []):
            instance_id = inst["InstanceId"]
            instance_type = inst.get("InstanceType", "unknown")
            name = _get_tag(inst.get("Tags", []), "Name") or instance_id
            estimated_cost = _estimate_ec2_cost(instance_type)

            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=14)
            metrics = cw.get_metric_statistics(
                Namespace="AWS/EC2", MetricName="CPUUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=start_time, EndTime=end_time,
                Period=86400, Statistics=["Average"],
            )

            datapoints = metrics.get("Datapoints", [])
            avg_cpu = None
            if datapoints:
                avg_cpu = sum(d["Average"] for d in datapoints) / len(datapoints)

            is_idle = avg_cpu is not None and avg_cpu < 2.0
            created_by = _lookup_instance_creator(ct, instance_id, _tags_to_dict(inst.get("Tags", [])))

            results.append({
                "resource_type": "ec2_instance",
                "resource_id": instance_id,
                "resource_name": name,
                "region": region,
                "status": "running",
                "monthly_cost_usd": round(estimated_cost, 2),
                "waste_status": "idle" if is_idle else "active",
                "waste_reason": f"Average CPU {avg_cpu:.1f}% over 14 days — instance is nearly idle" if is_idle else None,
                "waste_monthly_cost_usd": round(estimated_cost, 2) if is_idle else 0,
                "metadata": {
                    "instance_type": instance_type,
                    "avg_cpu_14d": round(avg_cpu, 2) if avg_cpu is not None else None,
                    "created_by": created_by,
                    "key_name": inst.get("KeyName"),
                    "launch_time": inst.get("LaunchTime").isoformat() if inst.get("LaunchTime") else None,
                    "platform": inst.get("PlatformDetails", "Linux/UNIX"),
                    "private_ip": inst.get("PrivateIpAddress"),
                    "public_ip": inst.get("PublicIpAddress"),
                    "vpc_id": inst.get("VpcId"),
                    "subnet_id": inst.get("SubnetId"),
                    "tags": _tags_to_dict(inst.get("Tags", [])),
                },
            })

    return results


def detect_unattached_ebs(access_key_id: str, secret_access_key: str, region: str):
    """Find EBS volumes not attached to any instance."""
    ec2 = boto3.client("ec2", aws_access_key_id=access_key_id,
                        aws_secret_access_key=secret_access_key, region_name=region)

    volumes = ec2.describe_volumes(Filters=[{"Name": "status", "Values": ["available"]}])
    results = []

    for vol in volumes.get("Volumes", []):
        vol_type = vol.get("VolumeType", "gp3")
        size_gb = vol.get("Size", 0)
        cost = size_gb * EBS_COST_PER_GB.get(vol_type, 0.08)
        name = _get_tag(vol.get("Tags", []), "Name") or vol["VolumeId"]

        results.append({
            "resource_type": "ebs_volume",
            "resource_id": vol["VolumeId"],
            "resource_name": name,
            "region": region,
            "status": "available",
            "monthly_cost_usd": round(cost, 2),
            "waste_status": "unused",
            "waste_reason": f"Unattached {vol_type} volume ({size_gb} GB)",
            "waste_monthly_cost_usd": round(cost, 2),
            "metadata": {"volume_type": vol_type, "size_gb": size_gb,
                          "tags": _tags_to_dict(vol.get("Tags", []))},
        })

    return results


def detect_idle_rds(access_key_id: str, secret_access_key: str, region: str):
    """Scan ALL RDS instances — flag idle ones (0 connections for 7 days), include active ones too."""
    rds = boto3.client("rds", aws_access_key_id=access_key_id,
                        aws_secret_access_key=secret_access_key, region_name=region)
    cw = boto3.client("cloudwatch", aws_access_key_id=access_key_id,
                       aws_secret_access_key=secret_access_key, region_name=region)

    db_instances = rds.describe_db_instances()
    results = []

    for db in db_instances.get("DBInstances", []):
        db_id = db["DBInstanceIdentifier"]
        db_class = db.get("DBInstanceClass", "unknown")
        estimated_cost = _estimate_rds_cost(db_class)

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=7)
        metrics = cw.get_metric_statistics(
            Namespace="AWS/RDS", MetricName="DatabaseConnections",
            Dimensions=[{"Name": "DBInstanceIdentifier", "Value": db_id}],
            StartTime=start_time, EndTime=end_time,
            Period=86400, Statistics=["Sum"],
        )

        total_connections = sum(d.get("Sum", 0) for d in metrics.get("Datapoints", []))
        is_idle = total_connections == 0 and len(metrics.get("Datapoints", [])) > 0

        results.append({
            "resource_type": "rds_instance",
            "resource_id": db.get("DBInstanceArn", db_id),
            "resource_name": db_id,
            "region": region,
            "status": db.get("DBInstanceStatus", "available"),
            "monthly_cost_usd": round(estimated_cost, 2),
            "waste_status": "unused" if is_idle else "active",
            "waste_reason": "Zero database connections for 7 days — no application is using this database" if is_idle else None,
            "waste_monthly_cost_usd": round(estimated_cost, 2) if is_idle else 0,
            "metadata": {"db_class": db_class, "engine": db.get("Engine", ""),
                          "storage_gb": db.get("AllocatedStorage", 0),
                          "total_connections_7d": total_connections},
        })

    return results


def detect_unassociated_eips(access_key_id: str, secret_access_key: str, region: str):
    """Find Elastic IPs not associated to any instance/ENI."""
    ec2 = boto3.client("ec2", aws_access_key_id=access_key_id,
                        aws_secret_access_key=secret_access_key, region_name=region)

    addresses = ec2.describe_addresses()
    results = []

    for addr in addresses.get("Addresses", []):
        if not addr.get("AssociationId"):
            results.append({
                "resource_type": "elastic_ip",
                "resource_id": addr.get("AllocationId", addr.get("PublicIp", "")),
                "resource_name": addr.get("PublicIp", "Unknown EIP"),
                "region": region,
                "status": "unassociated",
                "monthly_cost_usd": EIP_MONTHLY_COST,
                "waste_status": "unused",
                "waste_reason": "Elastic IP not associated to any resource ($3.65/mo since Feb 2024)",
                "waste_monthly_cost_usd": EIP_MONTHLY_COST,
                "metadata": {"public_ip": addr.get("PublicIp", ""),
                              "tags": _tags_to_dict(addr.get("Tags", []))},
            })

    return results


# --- Helpers ---

def _get_tag(tags: list, key: str) -> str | None:
    for tag in tags:
        if tag.get("Key") == key:
            return tag.get("Value")
    return None


def _tags_to_dict(tags: list) -> dict:
    return {tag["Key"]: tag["Value"] for tag in tags if "Key" in tag and "Value" in tag}


def _estimate_ec2_cost(instance_type: str) -> float:
    """Rough monthly cost estimates for common instance types (us-east-1, on-demand, Linux)."""
    estimates = {
        "t2.micro": 8.35, "t2.small": 16.70, "t2.medium": 33.41, "t2.large": 66.82,
        "t3.micro": 7.49, "t3.small": 14.98, "t3.medium": 29.95, "t3.large": 59.90,
        "t3.xlarge": 119.81, "t3.2xlarge": 239.62,
        "m5.large": 69.12, "m5.xlarge": 138.24, "m5.2xlarge": 276.48,
        "m6i.large": 69.12, "m6i.xlarge": 138.24,
        "c5.large": 61.20, "c5.xlarge": 122.40,
        "r5.large": 90.72, "r5.xlarge": 181.44,
    }
    return estimates.get(instance_type, 50.0)


def _estimate_rds_cost(db_class: str) -> float:
    """Rough monthly cost estimates for common RDS instance classes."""
    estimates = {
        "db.t3.micro": 12.41, "db.t3.small": 24.82, "db.t3.medium": 49.64,
        "db.t3.large": 99.28, "db.m5.large": 124.10, "db.m5.xlarge": 248.20,
        "db.r5.large": 172.80, "db.r5.xlarge": 345.60,
    }
    return estimates.get(db_class, 100.0)
