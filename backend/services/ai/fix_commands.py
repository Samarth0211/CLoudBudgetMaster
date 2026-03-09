"""Generate AWS CLI commands and Terraform snippets for fixing wasteful resources."""


def generate_fix_commands(resource: dict) -> dict:
    """Return CLI commands and Terraform snippets for a given resource."""
    r_type = resource.get("resource_type", "")
    waste_status = resource.get("waste_status", "")
    resource_id = resource.get("resource_id", "RESOURCE_ID")
    region = resource.get("region", "us-east-1")
    meta = resource.get("metadata") or {}

    cli_commands = []
    terraform = ""

    if r_type == "ec2_instance":
        if waste_status == "unused":
            # Stopped instance
            cli_commands = [
                f"# Create AMI backup before terminating",
                f"aws ec2 create-image --instance-id {resource_id} --name \"backup-{resource_id}\" --region {region}",
                f"",
                f"# Terminate the stopped instance",
                f"aws ec2 terminate-instances --instance-ids {resource_id} --region {region}",
            ]
            terraform = f"""# Remove the stopped EC2 instance
# First, remove from state if managed by Terraform:
# terraform state rm aws_instance.{_safe_name(resource_id)}

# Or import and destroy:
resource "aws_instance" "to_remove" {{
  # This instance will be terminated
  # Run: terraform destroy -target=aws_instance.to_remove
}}"""

        elif waste_status == "idle":
            current_type = meta.get("instance_type", "m5.large")
            suggested = _suggest_downsize(current_type)
            cli_commands = [
                f"# Stop the instance first",
                f"aws ec2 stop-instances --instance-ids {resource_id} --region {region}",
                f"",
                f"# Downsize from {current_type} to {suggested}",
                f"aws ec2 modify-instance-attribute --instance-id {resource_id} --instance-type {{\"Value\": \"{suggested}\"}} --region {region}",
                f"",
                f"# Restart the instance",
                f"aws ec2 start-instances --instance-ids {resource_id} --region {region}",
            ]
            terraform = f"""# Downsize the EC2 instance
resource "aws_instance" "this" {{
  instance_type = "{suggested}"  # was: {current_type}
  # Apply with: terraform apply
}}"""

    elif r_type == "ebs_volume":
        volume_id = resource_id
        cli_commands = [
            f"# Create snapshot backup",
            f"aws ec2 create-snapshot --volume-id {volume_id} --description \"backup-{volume_id}\" --region {region}",
            f"",
            f"# Delete the unattached volume",
            f"aws ec2 delete-volume --volume-id {volume_id} --region {region}",
        ]
        terraform = f"""# Remove unattached EBS volume
# terraform state rm aws_ebs_volume.{_safe_name(volume_id)}
# Or destroy directly:
# terraform destroy -target=aws_ebs_volume.{_safe_name(volume_id)}"""

    elif r_type == "rds_instance":
        db_id = meta.get("db_identifier", resource_id)
        cli_commands = [
            f"# Create final snapshot and delete",
            f"aws rds delete-db-instance --db-instance-identifier {db_id} --final-db-snapshot-identifier final-{db_id} --region {region}",
            f"",
            f"# Or stop temporarily (auto-restarts after 7 days)",
            f"aws rds stop-db-instance --db-instance-identifier {db_id} --region {region}",
        ]
        terraform = f"""# Remove idle RDS instance
# terraform destroy -target=aws_db_instance.{_safe_name(db_id)}

# Or stop via CLI (Terraform doesn't support stop/start):
# aws rds stop-db-instance --db-instance-identifier {db_id}"""

    elif r_type == "elastic_ip":
        alloc_id = meta.get("allocation_id", resource_id)
        cli_commands = [
            f"# Release the unassociated Elastic IP",
            f"aws ec2 release-address --allocation-id {alloc_id} --region {region}",
        ]
        terraform = f"""# Release Elastic IP
# terraform destroy -target=aws_eip.{_safe_name(alloc_id)}"""

    else:
        cli_commands = [
            f"# Review this resource in the AWS Console",
            f"# Resource: {resource_id} in {region}",
        ]
        terraform = "# No specific Terraform snippet available for this resource type"

    return {
        "cli_commands": cli_commands,
        "terraform": terraform,
        "warning": "Review these commands carefully before running. They will modify your infrastructure.",
    }


def _suggest_downsize(instance_type: str) -> str:
    """Suggest a smaller instance type."""
    downsizes = {
        "m5.xlarge": "m5.large",
        "m5.large": "t3.medium",
        "m5.2xlarge": "m5.xlarge",
        "t3.large": "t3.medium",
        "t3.medium": "t3.small",
        "t3.small": "t3.micro",
        "r5.large": "t3.medium",
        "r5.xlarge": "r5.large",
        "c5.large": "t3.medium",
        "c5.xlarge": "c5.large",
    }
    return downsizes.get(instance_type, "t3.small")


def _safe_name(resource_id: str) -> str:
    """Convert resource ID to safe Terraform name."""
    return resource_id.replace("-", "_").replace(".", "_").lower()
