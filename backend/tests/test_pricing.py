"""Deterministic tests for the AWS Price List parser + mappings.

These validate the part that must be exact (parsing the GetProducts response into
a monthly USD figure) without needing live AWS access. The JSON shapes mirror real
Price List API output.
"""
from backend.services.aws import pricing
from backend.services.aws.pricing import (
    _first_hourly_usd, ec2_monthly_cost, rds_monthly_cost,
    REGION_TO_LOCATION, EC2_OS, RDS_ENGINE, HOURS_PER_MONTH,
)


def _ec2_product(usd: str, unit: str = "Hrs", extra_zero_dim: bool = False):
    dims = {
        "SKU.TERM.RATE": {"unit": unit, "pricePerUnit": {"USD": usd},
                          "description": f"${usd} per On Demand Linux t3.micro Instance Hour"},
    }
    if extra_zero_dim:
        # AWS sometimes includes a $0.00 dimension; the parser must skip it.
        dims = {"SKU.TERM.ZERO": {"unit": "Hrs", "pricePerUnit": {"USD": "0.0000000000"}}, **dims}
    return {
        "product": {"attributes": {"instanceType": "t3.micro"}, "sku": "SKU"},
        "terms": {"OnDemand": {"SKU.TERM": {"priceDimensions": dims, "sku": "SKU"}}},
    }


def test_parses_simple_hourly_rate():
    import json
    pl = [json.dumps(_ec2_product("0.0104000000"))]
    assert abs(_first_hourly_usd(pl) - 0.0104) < 1e-9


def test_skips_zero_dollar_dimension():
    import json
    pl = [json.dumps(_ec2_product("0.0832000000", extra_zero_dim=True))]
    assert abs(_first_hourly_usd(pl) - 0.0832) < 1e-9


def test_skips_non_hourly_units():
    import json
    # a GB-month line item must be ignored when looking for an hourly compute rate
    prod = _ec2_product("0.10", unit="GB-Mo")
    assert _first_hourly_usd([json.dumps(prod)]) is None


def test_accepts_dict_items_too():
    assert abs(_first_hourly_usd([_ec2_product("1.5")]) - 1.5) < 1e-9


def test_empty_or_garbage_pricelist_returns_none():
    assert _first_hourly_usd([]) is None
    assert _first_hourly_usd(["not json", "{}", '{"terms":{}}']) is None


def test_monthly_conversion_uses_730_hours(monkeypatch):
    # 0.0104/hr * 730 = 7.592 -> 7.59
    monkeypatch.setattr(pricing, "_query", lambda *a, **k: round(0.0104 * HOURS_PER_MONTH, 2))
    cost, source = ec2_monthly_cost("ak", "sk", "t3.micro", "us-east-1")
    assert source == "aws_pricing_api"
    assert cost == 7.59


def test_unknown_region_falls_back_without_api_call():
    cost, source = ec2_monthly_cost("ak", "sk", "t3.micro", "moon-base-1")
    assert cost is None and source == "estimate"


def test_rds_unknown_engine_falls_back():
    cost, source = rds_monthly_cost("ak", "sk", "db.t3.micro", "us-east-1", engine="cassandra")
    assert cost is None and source == "estimate"


def test_query_returning_none_falls_back_to_estimate(monkeypatch):
    monkeypatch.setattr(pricing, "_query", lambda *a, **k: None)
    cost, source = ec2_monthly_cost("ak", "sk", "weird.type", "us-east-1")
    assert cost is None and source == "estimate"


def test_region_and_os_engine_maps_have_core_entries():
    assert REGION_TO_LOCATION["us-east-1"] == "US East (N. Virginia)"
    assert REGION_TO_LOCATION["ap-south-1"] == "Asia Pacific (Mumbai)"
    assert EC2_OS["Linux/UNIX"] == "Linux"
    assert EC2_OS["Windows"] == "Windows"
    assert RDS_ENGINE["postgres"] == "PostgreSQL"
    assert RDS_ENGINE["mysql"] == "MySQL"
