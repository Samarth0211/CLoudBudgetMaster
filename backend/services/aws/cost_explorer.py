import boto3
from datetime import datetime, timedelta


def get_aws_daily_costs(access_key_id: str, secret_access_key: str, region: str = "us-east-1", lookback_days: int = 30):
    """Fetch daily cost breakdown from AWS Cost Explorer, grouped by service."""
    client = boto3.client(
        "ce",
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="us-east-1",  # CE endpoint only exists in us-east-1
    )

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=lookback_days)

    response = client.get_cost_and_usage(
        TimePeriod={"Start": start_date.isoformat(), "End": end_date.isoformat()},
        Granularity="DAILY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    results_by_date = []
    total_usd = 0.0

    for result in response["ResultsByTime"]:
        daily_total = 0.0
        daily_services = {}
        for group in result["Groups"]:
            amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
            service_name = group["Keys"][0]
            daily_services[service_name] = round(amount, 4)
            daily_total += amount

        results_by_date.append({
            "date": result["TimePeriod"]["Start"],
            "total_usd": round(daily_total, 4),
            "by_service": daily_services,
        })
        total_usd += daily_total

    return {
        "results_by_date": results_by_date,
        "total_usd": round(total_usd, 2),
    }


def validate_aws_credentials(access_key_id: str, secret_access_key: str, region: str = "us-east-1") -> bool:
    """Test if AWS credentials are valid using STS GetCallerIdentity."""
    try:
        client = boto3.client(
            "sts",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
        )
        client.get_caller_identity()
        return True
    except Exception:
        return False
