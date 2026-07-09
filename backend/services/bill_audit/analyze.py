"""Turns normalized AWS billing line items into a categorized findings report.

Three categories (validated product structure, see module docstring in the
bill_audit package):
  1. AI / ML spend           - Bedrock, SageMaker, GPU instance families
  2. Hidden networking        - NAT Gateway, public IPv4, data transfer/egress
  3. Idle / waste + traps     - EIP, unattached EBS, EKS fees, RDS, stopped-instance storage

Naming/pricing is kept consistent with what the live scanner already knows
(`backend/services/aws/unused.py`, `pricing.py`): same EIP monthly rate
($3.65, in effect since Feb 2024), same EBS volume-type vocabulary
(gp3/gp2/io1/io2/st1/sc1/standard), and the same "label estimates, don't
fabricate exact figures" discipline used there via `cost_source` /
`cost_basis`.

A billing CSV is strictly less informative than a live read-only scan:
  - It CANNOT prove a resource is currently idle/unattached/stopped  - it can
    only show that a *usage type consistent with* idle/unattached/stopped
    billing appeared on the bill (e.g. an EBS "unattached" or general storage
    usage type, or hourly EIP charges). We label every such finding
    "potential"/"likely" and say so explicitly, and note that the live scan
    confirms it exactly (CPU/connection metrics, attachment state, etc).
  - It CAN prove exact dollar amounts per service/usage type/region, because
    that is exactly what's in the bill. Category totals here are always real
    sums of CSV rows -- never invented.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from backend.services.bill_audit.parser import LineItem

# Matches unused.py's EIP rate so a bill-audit finding and a live-scan finding
# always agree on the same resource.
EIP_MONTHLY_COST = 3.65

# --- AI / ML ---------------------------------------------------------------

_AI_ML_SERVICES = {
    "amazon bedrock", "aws bedrock", "bedrock",
    "amazon sagemaker", "aws sagemaker", "sagemaker",
}

# GPU / accelerator instance family prefixes that show up inside Cost
# Explorer "Usage Type" strings, e.g. "BoxUsage:p4d.24xlarge" or
# "USE1-BoxUsage:g5.xlarge". We match the family as a full instance-type
# token so both Cost-Explorer-style and CUR-style usage type strings work.
# Real AWS type strings: p4d.24xlarge, p4de.24xlarge, p5.48xlarge,
# g5.xlarge, g5g.16xlarge, g6.12xlarge, g6e.xlarge, inf1.xlarge,
# inf2.24xlarge, trn1.32xlarge, trn1n.32xlarge.
_GPU_FAMILY_PREFIXES = ("p4", "p5", "g5", "g6", "inf", "trn")

# Matches a GPU family token as a full instance-type "size" component, e.g.
# "p4d.24xlarge", "g5.xlarge", "g5g.16xlarge", "inf2.24xlarge", "trn1.32xlarge".
# Structure: family, optional generation digit(s)/variant letter(s), a dot,
# then a standard AWS size suffix (nano/micro/small/medium/large, optionally
# prefixed with a multiplier number and/or "x", e.g. "xlarge"/"24xlarge"/
# "metal"). Bounded so it must start at a token boundary (not preceded by a
# letter/digit) to avoid matching inside an unrelated word.
_GPU_INSTANCE_TYPE_RE = re.compile(
    r"(?<![a-z0-9])(p4|p5|g5|g6|inf|trn)[a-z0-9]{0,3}\."
    r"(?:nano|micro|small|medium|\d*x?large|metal)",
)

# Share of total spend at/above which we attach a "runaway risk" note.
_AI_ML_RUNAWAY_SHARE = 0.20


def _is_ai_ml_service(service: str) -> bool:
    return service.strip().lower() in _AI_ML_SERVICES


def _gpu_family_in_usage_type(usage_type: str) -> str | None:
    """Return the matched GPU family token (e.g. 'p4') if usage_type names a
    GPU/accelerator instance type (e.g. contains 'p4d.24xlarge' or
    'g5.xlarge'), else None.
    """
    if not usage_type:
        return None
    m = _GPU_INSTANCE_TYPE_RE.search(usage_type.lower())
    return m.group(1) if m else None


# --- Hidden networking -------------------------------------------------


def _is_nat_gateway_row(service: str, usage_type: str, description: str) -> bool:
    hay = f"{usage_type} {description}".lower()
    return "natgateway" in hay.replace(" ", "").replace("-", "")


def _is_public_ipv4_row(usage_type: str, description: str) -> bool:
    hay = f"{usage_type} {description}".lower()
    return "publicipv4" in hay.replace(" ", "").replace("-", "") or "public ipv4" in hay


def _is_data_transfer_row(service: str, usage_type: str, description: str) -> bool:
    hay = f"{usage_type} {description}".lower()
    # Cost Explorer usage types commonly look like "DataTransfer-Out-Bytes",
    # "USE1-AWS-Out-Bytes", "USE1-DataTransfer-Regional-Bytes", etc. CUR
    # descriptions typically say "...data transfer...", "...bytes transferred
    # out..." in plain English. Match both. Exclude NAT/IPv4 rows (handled
    # separately) to avoid double counting the same dollar.
    if _is_nat_gateway_row(service, usage_type, description) or _is_public_ipv4_row(usage_type, description):
        return False
    markers = ("datatransfer", "data transfer", "-out-bytes", "-in-bytes", "egress", "bytes transferred")
    return any(m in hay for m in markers)


# --- Idle / waste + traps -----------------------------------------------

_EBS_UNATTACHED_MARKERS = ("unattached", "not-attached", "notattached")
_EBS_STORAGE_MARKERS = ("ebs:volumeusage", "volumeusage", "ebs:snapshot", "snapshotusage")
_EKS_SERVICES = {"amazon elastic container service for kubernetes", "amazon eks", "aws eks"}
_RDS_SERVICES = {"amazon relational database service", "amazon rds"}


def _is_eip_row(service: str, usage_type: str, description: str) -> bool:
    hay = f"{usage_type} {description}".lower()
    return "elasticip" in hay.replace(" ", "").replace("-", "") or "elastic ip" in hay


def _is_ebs_row(service: str) -> bool:
    return service.strip().lower() in ("amazon elastic block store", "amazon ebs")


def _looks_unattached_ebs(usage_type: str, description: str) -> bool:
    hay = f"{usage_type} {description}".lower()
    return any(m in hay for m in _EBS_UNATTACHED_MARKERS)


def _is_eks_row(service: str) -> bool:
    return service.strip().lower() in _EKS_SERVICES


def _is_rds_row(service: str) -> bool:
    return service.strip().lower() in _RDS_SERVICES


def _looks_stopped_instance_storage(service: str, usage_type: str, description: str) -> bool:
    # A cost CSV can't see instance state directly, but EBS storage usage
    # tied to an otherwise-absent compute line for the same instance is the
    # closest inferable signal, and that inference needs per-resource-id
    # granularity a summary CSV doesn't have. We only flag the much weaker,
    # honest signal: plain EBS volume-storage usage types, worded as
    # "potential" waste requiring the live scan to confirm attachment/state.
    return _is_ebs_row(service) and any(m in usage_type.lower() for m in _EBS_STORAGE_MARKERS)


@dataclass
class Finding:
    service: str
    usage_type: str
    region: str
    monthly_usd: float
    note: str
    confidence: str = "confirmed"  # "confirmed" | "likely" | "potential"

    def to_dict(self) -> dict:
        return {
            "service": self.service,
            "usage_type": self.usage_type,
            "region": self.region,
            "monthly_usd": self.monthly_usd,
            "note": self.note,
            "confidence": self.confidence,
        }


@dataclass
class CategoryReport:
    key: str
    label: str
    total_usd: float
    findings: list[Finding] = field(default_factory=list)
    extra_note: str | None = None

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "total_usd": self.total_usd,
            "extra_note": self.extra_note,
            "findings": [f.to_dict() for f in self.findings],
        }


@dataclass
class FindingsReport:
    total_spend_usd: float
    total_flagged_usd: float
    total_flagged_confirmed_usd: float
    total_flagged_potential_usd: float
    categories: list[CategoryReport]
    line_item_count: int
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_spend_usd": self.total_spend_usd,
            "total_flagged_usd": self.total_flagged_usd,
            "total_flagged_confirmed_usd": self.total_flagged_confirmed_usd,
            "total_flagged_potential_usd": self.total_flagged_potential_usd,
            "line_item_count": self.line_item_count,
            "categories": [c.to_dict() for c in self.categories],
            "warnings": self.warnings,
            "disclaimer": (
                "Figures are computed directly from your uploaded CSV. Items marked "
                "'likely' or 'potential' are inferred from usage-type naming and cannot "
                "be proven idle/unattached from billing data alone -- a live read-only "
                "scan confirms these exactly (attachment state, CPU/connection metrics)."
            ),
        }


def _sum(items: list[LineItem]) -> float:
    return round(sum(li.amount_usd for li in items), 2)


def _sum_findings(findings: list[Finding]) -> float:
    return round(sum(f.monthly_usd for f in findings), 2)


def analyze_line_items(line_items: list[LineItem], warnings: list[str] | None = None) -> FindingsReport:
    """Build the three-category findings report from normalized line items.

    Never fabricates numbers: every monthly_usd in every Finding is a direct
    sum of amount_usd values pulled from the input line items (CUR credit/
    refund/tax rows were already filtered out or excluded by the parser via
    record_type, but we defensively skip non-"Usage" record types here too
    in case a caller passes raw parsed items from elsewhere).
    """
    usage_items = [li for li in line_items if not li.record_type or li.record_type.lower() == "usage"]
    total_spend = _sum(usage_items)

    # --- AI / ML ---
    ai_ml_findings: list[Finding] = []
    for li in usage_items:
        if _is_ai_ml_service(li.service):
            ai_ml_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "(unspecified)", region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note="Managed AI/ML service spend (Bedrock/SageMaker).",
                confidence="confirmed",
            ))
            continue
        fam = _gpu_family_in_usage_type(li.usage_type)
        if fam:
            ai_ml_findings.append(Finding(
                service=li.service, usage_type=li.usage_type, region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note=f"GPU/accelerator instance family '{fam}' -- typically ML training/inference workloads.",
                confidence="confirmed",
            ))
    ai_ml_total = _sum_findings(ai_ml_findings)
    ai_ml_note = None
    if total_spend > 0 and ai_ml_total / total_spend >= _AI_ML_RUNAWAY_SHARE:
        pct = round(ai_ml_total / total_spend * 100)
        ai_ml_note = (
            f"AI/ML spend is {pct}% of total bill -- runaway risk. GPU and managed-model "
            "costs scale fast with usage; confirm this matches expected training/inference volume."
        )

    # --- Hidden networking ---
    net_findings: list[Finding] = []
    for li in usage_items:
        if _is_nat_gateway_row(li.service, li.usage_type, li.description):
            is_hourly = "hour" in li.usage_type.lower() or "hour" in li.description.lower()
            note = ("NAT Gateway hourly charge." if is_hourly else "NAT Gateway data processing charge "
                    "($/GB) -- often the largest line item on this bill without anyone realizing it.")
            net_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "NAT Gateway", region=li.region,
                monthly_usd=round(li.amount_usd, 2), note=note, confidence="confirmed",
            ))
        elif _is_public_ipv4_row(li.usage_type, li.description):
            net_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "Public IPv4", region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note="Public IPv4 address charge (AWS began billing all public IPv4 addresses Feb 2024).",
                confidence="confirmed",
            ))
        elif _is_data_transfer_row(li.service, li.usage_type, li.description):
            net_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "Data Transfer", region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note="Data transfer / egress charge.",
                confidence="confirmed",
            ))
    net_total = _sum_findings(net_findings)

    # --- Idle / waste + traps ---
    waste_findings: list[Finding] = []
    for li in usage_items:
        if _is_eip_row(li.service, li.usage_type, li.description):
            waste_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "Elastic IP", region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note=(
                    "Elastic IP hourly charge. Likely waste if unassociated "
                    f"(AWS bills ~${EIP_MONTHLY_COST}/mo per unassociated IP since Feb 2024) -- "
                    "a billing CSV can't confirm association state; the live scan does."
                ),
                confidence="likely",
            ))
        elif _is_ebs_row(li.service) and _looks_unattached_ebs(li.usage_type, li.description):
            waste_findings.append(Finding(
                service=li.service, usage_type=li.usage_type, region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note="Usage type indicates an unattached EBS volume -- confirmed exactly by the live scan.",
                confidence="likely",
            ))
        elif _looks_stopped_instance_storage(li.service, li.usage_type, li.description):
            waste_findings.append(Finding(
                service=li.service, usage_type=li.usage_type, region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note=(
                    "EBS storage charge. Potentially attached to a stopped/idle instance "
                    "still accruing storage cost -- a bill alone can't see instance state; "
                    "the live scan confirms this exactly."
                ),
                confidence="potential",
            ))
        elif _is_eks_row(li.service):
            is_control_plane = "cluster" in li.usage_type.lower() or "cluster" in li.description.lower()
            waste_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "EKS", region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note=(
                    "EKS control-plane fee ($0.10/hr per cluster, or extended-support surcharge on "
                    "old Kubernetes versions) -- flat charge regardless of workload size; worth "
                    "checking for orphaned/forgotten clusters."
                    if is_control_plane else
                    "EKS-related charge -- check for extended-support surcharges on outdated cluster versions."
                ),
                confidence="likely",
            ))
        elif _is_rds_row(li.service):
            waste_findings.append(Finding(
                service=li.service, usage_type=li.usage_type or "RDS", region=li.region,
                monthly_usd=round(li.amount_usd, 2),
                note=(
                    "RDS charge. A bill can't show connection activity -- the live scan flags "
                    "RDS instances with zero connections over 7 days as confirmed idle."
                ),
                confidence="potential",
            ))
    waste_total = _sum_findings(waste_findings)

    all_findings = ai_ml_findings + net_findings + waste_findings
    confirmed_total = _sum_findings([f for f in all_findings if f.confidence == "confirmed"])
    potential_total = _sum_findings([f for f in all_findings if f.confidence != "confirmed"])
    flagged_total = round(confirmed_total + potential_total, 2)

    categories = [
        CategoryReport(
            key="ai_ml", label="AI / ML spend", total_usd=ai_ml_total,
            findings=sorted(ai_ml_findings, key=lambda f: -f.monthly_usd), extra_note=ai_ml_note,
        ),
        CategoryReport(
            key="hidden_networking", label="Hidden networking", total_usd=net_total,
            findings=sorted(net_findings, key=lambda f: -f.monthly_usd),
            extra_note="NAT Gateway, public IPv4, and egress charges are the most common surprise line items in 2026.",
        ),
        CategoryReport(
            key="idle_waste", label="Idle / waste + traps", total_usd=waste_total,
            findings=sorted(waste_findings, key=lambda f: -f.monthly_usd),
            extra_note="Confidence-labeled: 'likely'/'potential' items need the live read-only scan to confirm exactly.",
        ),
    ]

    return FindingsReport(
        total_spend_usd=total_spend,
        total_flagged_usd=flagged_total,
        total_flagged_confirmed_usd=confirmed_total,
        total_flagged_potential_usd=potential_total,
        categories=categories,
        line_item_count=len(usage_items),
        warnings=list(warnings or []),
    )
