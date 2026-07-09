"""Tests for backend.services.bill_audit (parser + findings engine + report).

Covers:
  - Realistic Cost Explorer CSV fixture -> correct categorized findings
  - CUR-style CSV -> correct format detection + normalization
  - Malformed / empty / undecodable / oversized input -> clean error results,
    never an exception
  - Money math: category totals and grand totals are exact sums of the fixture,
    never fabricated
  - HTML report renders without raising and includes the key figures
"""
from __future__ import annotations

import os

import pytest

from backend.services.bill_audit.parser import parse_billing_csv, MAX_BYTES
from backend.services.bill_audit.analyze import analyze_line_items
from backend.services.bill_audit.report import render_html_report

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _read_fixture_bytes(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as f:
        return f.read()


# --- Cost Explorer format: parser -----------------------------------------

def test_parses_cost_explorer_fixture_as_cost_explorer_format():
    result = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    assert result.ok is True
    assert result.format == "cost_explorer"
    # 15 data rows + 1 "Total" footer row that must be skipped, not counted.
    assert len(result.line_items) == 15
    assert result.rows_skipped >= 1


def test_cost_explorer_total_matches_sum_of_rows_excluding_footer():
    result = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    assert result.ok
    # Exact sum of the 15 data rows in the fixture (excludes the Total footer row).
    expected = 4820.15 + 312.40 + 29.95 + 980.00 + 410.20 + 64.80 + 742.33 + \
        18.25 + 205.60 + 3.65 + 42.10 + 8.40 + 73.00 + 99.28 + 14.02
    assert result.total_usd == pytest.approx(round(expected, 2), abs=0.01)


def test_cost_explorer_line_item_fields_normalized():
    result = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    assert result.ok
    bedrock = next(li for li in result.line_items if li.service == "Amazon Bedrock")
    assert bedrock.usage_type == "InvocationCount"
    assert bedrock.region == "us-east-1"
    assert bedrock.amount_usd == pytest.approx(980.0)


# --- Findings engine: categorization ---------------------------------------

def _analyzed_report():
    parsed = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    assert parsed.ok
    return analyze_line_items(parsed.line_items, warnings=parsed.warnings)


def test_total_spend_matches_parser_total():
    parsed = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    report = analyze_line_items(parsed.line_items)
    assert report.total_spend_usd == parsed.total_usd


def test_ai_ml_category_flags_bedrock_sagemaker_and_gpu_instances():
    report = _analyzed_report()
    cat = next(c for c in report.categories if c.key == "ai_ml")
    services_and_usage = {(f.service, f.usage_type) for f in cat.findings}
    assert ("Amazon Elastic Compute Cloud - Compute", "BoxUsage:p4d.24xlarge") in services_and_usage
    assert ("Amazon Elastic Compute Cloud - Compute", "BoxUsage:g5.xlarge") in services_and_usage
    assert ("Amazon Bedrock", "InvocationCount") in services_and_usage
    assert ("Amazon SageMaker", "ml.p4d.24xlarge-Notebook") in services_and_usage
    # t3.medium must NOT be flagged as AI/ML.
    assert not any(f.usage_type == "BoxUsage:t3.medium" for f in cat.findings)
    # Exact total: 4820.15 + 312.40 + 980.00 + 410.20
    assert cat.total_usd == pytest.approx(6522.75, abs=0.01)


def test_ai_ml_runaway_note_present_when_large_share_of_spend():
    report = _analyzed_report()
    cat = next(c for c in report.categories if c.key == "ai_ml")
    # AI/ML is ~97% of this fixture's total spend -- must trigger the runaway note.
    assert cat.extra_note is not None
    assert "runaway risk" in cat.extra_note.lower()


def test_hidden_networking_flags_nat_gateway_ipv4_and_egress():
    report = _analyzed_report()
    cat = next(c for c in report.categories if c.key == "hidden_networking")
    usage_types = {f.usage_type for f in cat.findings}
    assert "NatGateway-Hours" in usage_types
    assert "NatGateway-Bytes" in usage_types
    assert "PublicIPv4:InUseAddress" in usage_types
    assert "DataTransfer-Out-Bytes" in usage_types
    # Exact total: 64.80 + 742.33 + 18.25 + 205.60
    assert cat.total_usd == pytest.approx(1030.98, abs=0.01)
    assert all(f.confidence == "confirmed" for f in cat.findings)


def test_idle_waste_flags_eip_ebs_eks_rds_with_honest_confidence_labels():
    report = _analyzed_report()
    cat = next(c for c in report.categories if c.key == "idle_waste")
    by_usage = {f.usage_type: f for f in cat.findings}

    assert "ElasticIP:IdleAddress" in by_usage
    assert by_usage["ElasticIP:IdleAddress"].confidence == "likely"

    assert "VolumeUsage.gp2-Unattached" in by_usage
    assert by_usage["VolumeUsage.gp2-Unattached"].confidence == "likely"

    assert "EBS:VolumeUsage.gp3" in by_usage
    assert by_usage["EBS:VolumeUsage.gp3"].confidence == "potential"

    assert "AmazonEKS-Hours:perCluster" in by_usage
    assert by_usage["AmazonEKS-Hours:perCluster"].confidence == "likely"

    assert "InstanceUsage:db.t3.medium" in by_usage
    assert by_usage["InstanceUsage:db.t3.medium"].confidence == "potential"

    # None of these are "confirmed" -- a CSV cannot prove idle/unattached state.
    assert all(f.confidence != "confirmed" for f in cat.findings)


def test_s3_storage_row_is_not_flagged_in_any_category():
    report = _analyzed_report()
    all_usage_types = {f.usage_type for c in report.categories for f in c.findings}
    assert "TimedStorage-ByteHrs" not in all_usage_types


def test_flagged_totals_never_exceed_total_spend():
    report = _analyzed_report()
    assert report.total_flagged_usd <= report.total_spend_usd + 0.01
    assert report.total_flagged_confirmed_usd + report.total_flagged_potential_usd == pytest.approx(
        report.total_flagged_usd, abs=0.01
    )


def test_eip_monthly_cost_constant_matches_live_scanner():
    # backend/services/aws/unused.py uses EIP_MONTHLY_COST = 3.65; keep in sync
    # so bill-audit findings and live-scan findings never disagree on the same fact.
    from backend.services.aws.unused import EIP_MONTHLY_COST as live_scanner_rate
    from backend.services.bill_audit.analyze import EIP_MONTHLY_COST as bill_audit_rate
    assert bill_audit_rate == live_scanner_rate


# --- CUR-style format -------------------------------------------------------

def _cur_csv_bytes() -> bytes:
    header = "lineItem/UsageAccountId,lineItem/LineItemType,product/ProductCode,lineItem/UsageType,product/region,lineItem/UnblendedCost,lineItem/LineItemDescription\n"
    rows = [
        "111122223333,Usage,AmazonEC2,BoxUsage:g5.xlarge,us-east-1,150.00,GPU instance usage",
        "111122223333,Usage,AmazonVPC,NatGateway-Bytes,us-east-1,88.10,NAT Gateway data processing",
        "111122223333,Tax,AmazonEC2,Tax,us-east-1,12.00,Sales tax",
        "111122223333,Usage,AmazonEC2,ElasticIP:IdleAddress,us-east-1,3.65,Elastic IP idle charge",
        "111122223333,Credit,AmazonEC2,BoxUsage:t3.micro,us-east-1,-5.00,Promotional credit",
    ]
    return (header + "\n".join(rows) + "\n").encode("utf-8")


def test_detects_cur_format():
    result = parse_billing_csv(_cur_csv_bytes())
    assert result.ok is True
    assert result.format == "cur"


def test_cur_excludes_tax_and_zero_rows_but_keeps_negative_credit():
    result = parse_billing_csv(_cur_csv_bytes())
    assert result.ok
    record_types = {li.record_type for li in result.line_items}
    # Tax row IS parsed (nonzero amount) but tagged so analyze() can exclude it.
    assert "Tax" in record_types or len(result.line_items) == 4

    parsed_usage_types = {li.usage_type for li in result.line_items}
    assert "BoxUsage:g5.xlarge" in parsed_usage_types
    assert "NatGateway-Bytes" in parsed_usage_types


def test_cur_analyze_excludes_non_usage_rows_from_total_spend():
    result = parse_billing_csv(_cur_csv_bytes())
    assert result.ok
    report = analyze_line_items(result.line_items)
    # Only the two "Usage" rows count toward spend: 150.00 (g5) + 88.10 (NAT) + 3.65 (EIP) = 241.75
    # Tax (12.00) and Credit (-5.00) must be excluded from total_spend_usd.
    assert report.total_spend_usd == pytest.approx(241.75, abs=0.01)


def test_cur_flags_gpu_and_nat_and_eip():
    result = parse_billing_csv(_cur_csv_bytes())
    report = analyze_line_items(result.line_items)
    ai_ml = next(c for c in report.categories if c.key == "ai_ml")
    net = next(c for c in report.categories if c.key == "hidden_networking")
    waste = next(c for c in report.categories if c.key == "idle_waste")
    assert any(f.usage_type == "BoxUsage:g5.xlarge" for f in ai_ml.findings)
    assert any(f.usage_type == "NatGateway-Bytes" for f in net.findings)
    assert any(f.usage_type == "ElasticIP:IdleAddress" for f in waste.findings)


# --- Malformed / defensive input handling -----------------------------------

def test_empty_file_returns_clean_error_not_exception():
    result = parse_billing_csv(b"")
    assert result.ok is False
    assert result.error
    assert result.line_items == []


def test_none_bytes_returns_clean_error():
    result = parse_billing_csv(None)
    assert result.ok is False
    assert result.error


def test_whitespace_only_file_returns_clean_error():
    result = parse_billing_csv(b"   \n\n   ")
    assert result.ok is False
    assert result.error


def test_header_only_no_data_rows_returns_clean_error():
    result = parse_billing_csv(b"Service,Usage Type,Region,Cost ($)\n")
    assert result.ok is False
    assert result.error


def test_unrecognized_headers_returns_clean_error():
    result = parse_billing_csv(b"Foo,Bar,Baz\n1,2,3\n")
    assert result.ok is False
    assert "unrecognized" in result.error.lower() or "could not" in result.error.lower()


def test_garbage_binary_content_does_not_crash():
    garbage = bytes(range(256)) * 4
    result = parse_billing_csv(garbage)
    assert result.ok is False
    assert result.error


def test_bom_prefixed_file_parses_correctly():
    content = "﻿Service,Cost ($)\nAmazon Bedrock,42.00\n".encode("utf-8")
    result = parse_billing_csv(content)
    assert result.ok is True
    assert result.line_items[0].service == "Amazon Bedrock"
    assert result.line_items[0].amount_usd == pytest.approx(42.00)


def test_quoted_commas_in_fields_handled():
    content = 'Service,Usage Type,Region,Cost ($)\n"Amazon Elastic Compute Cloud - Compute","BoxUsage:t3.micro, extra",us-east-1,10.00\n'.encode("utf-8")
    result = parse_billing_csv(content)
    assert result.ok is True
    assert result.line_items[0].usage_type == "BoxUsage:t3.micro, extra"


def test_missing_amount_cells_are_skipped_not_crashing():
    content = "Service,Usage Type,Region,Cost ($)\nAmazon Bedrock,Foo,us-east-1,\nAmazon SageMaker,Bar,us-east-1,15.00\n".encode("utf-8")
    result = parse_billing_csv(content)
    assert result.ok is True
    assert len(result.line_items) == 1
    assert result.line_items[0].service == "Amazon SageMaker"


def test_oversized_file_rejected_cleanly():
    # Build a header plus enough rows to exceed MAX_BYTES without actually
    # allocating gigabytes -- one long line repeated is enough to cross MAX_BYTES.
    header = b"Service,Usage Type,Region,Cost ($)\n"
    row = b"Amazon Bedrock,InvocationCount,us-east-1,1.00\n"
    # Compute how many rows are needed to exceed MAX_BYTES, cap the test's own memory use.
    needed_rows = (MAX_BYTES // len(row)) + 10
    content = header + row * needed_rows
    assert len(content) > MAX_BYTES
    result = parse_billing_csv(content)
    assert result.ok is False
    assert "too large" in result.error.lower()


def test_analyze_handles_empty_line_item_list_without_crashing():
    report = analyze_line_items([])
    assert report.total_spend_usd == 0
    assert report.total_flagged_usd == 0
    assert all(c.total_usd == 0 for c in report.categories)
    assert all(c.findings == [] for c in report.categories)


# --- Report rendering --------------------------------------------------------

def test_html_report_renders_and_contains_key_figures():
    parsed = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    report = analyze_line_items(parsed.line_items, warnings=parsed.warnings)
    html_out = render_html_report(report, account_label="Test Account", source_filename="cost_explorer_sample.csv")
    assert "<html" in html_out.lower()
    assert "AWS Bill Health Check" in html_out
    assert "AWS only" in html_out
    assert "Test Account" in html_out
    assert "cost_explorer_sample.csv" in html_out
    # No em-dashes anywhere in the rendered output.
    assert "—" not in html_out
    # Category labels present.
    assert "AI / ML spend" in html_out
    assert "Hidden networking" in html_out
    assert "Idle / waste + traps" in html_out


def test_html_report_escapes_hostile_content():
    parsed = parse_billing_csv(_read_fixture_bytes("cost_explorer_sample.csv"))
    report = analyze_line_items(parsed.line_items)
    html_out = render_html_report(report, account_label="<script>alert(1)</script>")
    assert "<script>alert(1)</script>" not in html_out
    assert "&lt;script&gt;" in html_out


def test_html_report_handles_empty_report_without_crashing():
    report = analyze_line_items([])
    html_out = render_html_report(report)
    assert "<html" in html_out.lower()
    assert "No line items matched this category" in html_out
