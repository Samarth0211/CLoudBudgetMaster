"""Accurate per-resource pricing from the AWS Price List API (on-demand list price).

Replaces the hardcoded EC2/RDS estimate tables with real, current, region- and
OS/engine-aware on-demand prices. Everything degrades gracefully: if the
`pricing:GetProducts` permission is missing or a price can't be resolved, callers
fall back to the static estimate and the cost is labelled accordingly.

Source of truth: AWS Price List Query API (`pricing` / GetProducts). The endpoint
lives only in a few regions; we always call it in us-east-1. Prices are public
(not account-specific) and stable, so results are cached per process.

Returns (monthly_usd: float | None, source: str). source is one of:
  "aws_pricing_api"  — exact on-demand list price from AWS
  None monthly_usd   — caller should fall back to its estimate (source "estimate")
"""
import json

import boto3
from botocore.exceptions import ClientError, BotoCoreError

HOURS_PER_MONTH = 730  # AWS's standard convention for monthly estimates

# region code -> Price List "location" display name (commercial regions)
REGION_TO_LOCATION = {
    "us-east-1": "US East (N. Virginia)",
    "us-east-2": "US East (Ohio)",
    "us-west-1": "US West (N. California)",
    "us-west-2": "US West (Oregon)",
    "af-south-1": "Africa (Cape Town)",
    "ap-east-1": "Asia Pacific (Hong Kong)",
    "ap-south-1": "Asia Pacific (Mumbai)",
    "ap-south-2": "Asia Pacific (Hyderabad)",
    "ap-southeast-1": "Asia Pacific (Singapore)",
    "ap-southeast-2": "Asia Pacific (Sydney)",
    "ap-southeast-3": "Asia Pacific (Jakarta)",
    "ap-southeast-4": "Asia Pacific (Melbourne)",
    "ap-northeast-1": "Asia Pacific (Tokyo)",
    "ap-northeast-2": "Asia Pacific (Seoul)",
    "ap-northeast-3": "Asia Pacific (Osaka)",
    "ca-central-1": "Canada (Central)",
    "ca-west-1": "Canada West (Calgary)",
    "eu-central-1": "EU (Frankfurt)",
    "eu-central-2": "EU (Zurich)",
    "eu-west-1": "EU (Ireland)",
    "eu-west-2": "EU (London)",
    "eu-west-3": "EU (Paris)",
    "eu-north-1": "EU (Stockholm)",
    "eu-south-1": "EU (Milan)",
    "eu-south-2": "EU (Spain)",
    "me-south-1": "Middle East (Bahrain)",
    "me-central-1": "Middle East (UAE)",
    "sa-east-1": "South America (Sao Paulo)",
    "il-central-1": "Israel (Tel Aviv)",
}

# EC2 PlatformDetails -> Price List operatingSystem
EC2_OS = {
    "Linux/UNIX": "Linux",
    "Linux": "Linux",
    "Red Hat Enterprise Linux": "RHEL",
    "RHEL": "RHEL",
    "SUSE Linux": "SUSE",
    "SUSE": "SUSE",
    "Windows": "Windows",
}

# RDS engine code -> Price List databaseEngine
RDS_ENGINE = {
    "mysql": "MySQL",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "mariadb": "MariaDB",
    "oracle-se2": "Oracle",
    "oracle-ee": "Oracle",
    "oracle-se": "Oracle",
    "sqlserver-ex": "SQL Server",
    "sqlserver-web": "SQL Server",
    "sqlserver-se": "SQL Server",
    "sqlserver-ee": "SQL Server",
    "aurora-mysql": "Aurora MySQL",
    "aurora-postgresql": "Aurora PostgreSQL",
}

_client_cache: dict = {}
_price_cache: dict = {}


def _client(access_key: str, secret_key: str):
    key = access_key
    if key not in _client_cache:
        _client_cache[key] = boto3.client(
            "pricing", aws_access_key_id=access_key,
            aws_secret_access_key=secret_key, region_name="us-east-1",
        )
    return _client_cache[key]


def _first_hourly_usd(price_list: list) -> float | None:
    """Parse the first valid positive on-demand hourly USD rate from a PriceList."""
    for item in price_list:
        try:
            data = json.loads(item) if isinstance(item, str) else item
            terms = data.get("terms", {}).get("OnDemand", {})
            for term in terms.values():
                for dim in term.get("priceDimensions", {}).values():
                    unit = (dim.get("unit") or "").lower()
                    if unit not in ("hrs", "hours", "hour"):
                        continue
                    usd = dim.get("pricePerUnit", {}).get("USD")
                    if usd is None:
                        continue
                    val = float(usd)
                    if val > 0:
                        return val
        except (ValueError, KeyError, TypeError):
            continue
    return None


def _query(access_key, secret_key, service_code, filters, cache_key):
    if cache_key in _price_cache:
        return _price_cache[cache_key]
    try:
        resp = _client(access_key, secret_key).get_products(
            ServiceCode=service_code,
            Filters=[{"Type": "TERM_MATCH", "Field": f, "Value": v} for f, v in filters],
            MaxResults=100,
        )
        hourly = _first_hourly_usd(resp.get("PriceList", []))
        monthly = round(hourly * HOURS_PER_MONTH, 2) if hourly is not None else None
    except (ClientError, BotoCoreError) as e:
        print(f"[pricing] {service_code} lookup failed ({cache_key}): {e}")
        monthly = None
    _price_cache[cache_key] = monthly
    return monthly


def ec2_monthly_cost(access_key, secret_key, instance_type, region, platform_details="Linux/UNIX"):
    """Exact on-demand monthly cost for a running EC2 instance, or (None, 'estimate')."""
    location = REGION_TO_LOCATION.get(region)
    os_name = EC2_OS.get(platform_details, "Linux")
    if not location:
        return None, "estimate"
    monthly = _query(
        access_key, secret_key, "AmazonEC2",
        [
            ("instanceType", instance_type),
            ("location", location),
            ("operatingSystem", os_name),
            ("tenancy", "Shared"),
            ("preInstalledSw", "NA"),
            ("capacitystatus", "Used"),
        ],
        cache_key=f"ec2|{instance_type}|{location}|{os_name}",
    )
    return (monthly, "aws_pricing_api") if monthly is not None else (None, "estimate")


def rds_monthly_cost(access_key, secret_key, db_class, region, engine="mysql", multi_az=False):
    """Exact on-demand monthly cost for an RDS instance, or (None, 'estimate')."""
    location = REGION_TO_LOCATION.get(region)
    db_engine = RDS_ENGINE.get((engine or "").lower())
    if not location or not db_engine:
        return None, "estimate"
    monthly = _query(
        access_key, secret_key, "AmazonRDS",
        [
            ("instanceType", db_class),
            ("location", location),
            ("databaseEngine", db_engine),
            ("deploymentOption", "Multi-AZ" if multi_az else "Single-AZ"),
        ],
        cache_key=f"rds|{db_class}|{location}|{db_engine}|{'maz' if multi_az else 'saz'}",
    )
    return (monthly, "aws_pricing_api") if monthly is not None else (None, "estimate")
