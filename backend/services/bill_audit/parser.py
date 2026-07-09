"""Parses an AWS billing CSV into a normalized list of line items.

Supports two input shapes, auto-detected from the header row:

1. "Cost Explorer export"  - the CSV a user downloads from the AWS Console's
   Cost Explorer "Download as CSV" button, typically grouped by Service and/or
   Usage Type. Header names vary release to release ("Cost ($)" vs "Cost",
   "Usage type" vs "UsageType", etc.) so we match a set of known aliases
   case-insensitively.

2. "CUR-style export"  - a (possibly trimmed) Cost & Usage Report, identified by
   the `lineItem/...` / `product/...` column-family prefix used by AWS CUR
   (and CUR 2.0 / Data Exports "legacy CUR" mode). We only need a handful of
   columns to build the same normalized shape.

Design goals:
  - Never raise on bad input. Always return a ParseResult; put the problem in
    ParseResult.error / ParseResult.warnings.
  - Don't require loading the whole file into memory as a Python list before
    processing  - we stream row-by-row with csv.reader over a text wrapper.
    (The final normalized line-item list is still materialized, since the
    findings engine needs random access to it, but we don't do anything
    quadratic or duplicate the raw file in memory.)
  - Tolerate BOM, quoted commas/newlines within fields (stdlib csv handles
    this), blank rows, stray totals/footer rows, and partially-missing
    columns.
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field

# Cap on rows we'll parse from a single upload. A "no-signup hero tool" upload
# should be one account's monthly bill (hundreds to low-thousands of rows for
# a Cost-Explorer-grouped export; CUR exports can be much bigger, which is
# exactly why this exists as a safety valve rather than an accident).
MAX_ROWS = 200_000

# Bytes cap so we bail out cleanly on someone uploading a multi-GB raw CUR
# dump instead of a grouped export. This is a backbone module; the caller
# (future upload endpoint) should also enforce its own request-size limit,
# but we don't trust that and check here too.
MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@dataclass
class LineItem:
    """One normalized row of AWS spend."""
    service: str
    usage_type: str
    region: str
    amount_usd: float
    description: str = ""
    record_type: str = ""  # CUR only: Usage / Tax / Credit / Fee / Refund / ...

    def to_dict(self) -> dict:
        return {
            "service": self.service,
            "usage_type": self.usage_type,
            "region": self.region,
            "amount_usd": self.amount_usd,
            "description": self.description,
            "record_type": self.record_type,
        }


@dataclass
class ParseResult:
    ok: bool
    format: str | None = None  # "cost_explorer" | "cur" | None
    line_items: list[LineItem] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    error: str | None = None
    rows_seen: int = 0
    rows_skipped: int = 0

    @property
    def total_usd(self) -> float:
        return round(sum(li.amount_usd for li in self.line_items), 2)


# --- Header alias tables -----------------------------------------------

_CE_SERVICE_ALIASES = {"service", "product", "product name", "service name"}
_CE_USAGE_TYPE_ALIASES = {"usage type", "usagetype", "usage_type"}
_CE_REGION_ALIASES = {"region", "aws region", "location"}
_CE_COST_ALIASES = {
    "cost ($)", "cost (usd)", "cost", "amount", "amount ($)", "unblended cost ($)",
    "unblendedcost", "total cost ($)", "total cost", "blended cost ($)",
}
_CE_DESCRIPTION_ALIASES = {"description", "usage type details", "item description"}

# CUR columns are addressed by suffix after the last '/', since some exports
# prefix with "lineItem" and others with "line_item" or include a resourceId
# family etc. We match on the normalized (lowercased, slash-free) column tail.
_CUR_SERVICE_COLS = {"productcode", "product_code", "servicecode"}
_CUR_USAGE_TYPE_COLS = {"usagetype", "usage_type"}
_CUR_REGION_COLS = {"region", "productregion"}
_CUR_COST_COLS = {"unblendedcost", "unblended_cost"}
_CUR_DESCRIPTION_COLS = {"lineitemdescription", "line_item_description"}
_CUR_RECORD_TYPE_COLS = {"lineitemtype", "line_item_type"}


def _strip_bom(text: str) -> str:
    return text.lstrip("﻿")


def _norm_header(h: str) -> str:
    return (h or "").strip().strip('"').lower()


def _norm_cur_col(h: str) -> str:
    """CUR columns look like 'lineItem/UnblendedCost' or 'product/region'.
    Normalize to the tail after the slash, lowercased, underscores stripped
    of surrounding whitespace, so 'lineItem/UnblendedCost' -> 'unblendedcost'.
    """
    h = (h or "").strip().strip('"')
    tail = h.split("/")[-1]
    return tail.strip().lower().replace(" ", "")


def _detect_format(headers: list[str]) -> str | None:
    normed = [_norm_header(h) for h in headers]
    cur_normed = [_norm_cur_col(h) for h in headers]

    # CUR signature: any column containing a '/' family prefix we recognize,
    # OR a bare column name matching CUR's characteristic fields exactly
    # (e.g. downloaded CUR sometimes has the prefix stripped by the export
    # tool but keeps distinctive names like "lineItemType").
    has_cur_slash = any("/" in h for h in headers)
    cur_hit = any(c in _CUR_SERVICE_COLS or c in _CUR_USAGE_TYPE_COLS or c in _CUR_COST_COLS
                  for c in cur_normed)
    if has_cur_slash and cur_hit:
        return "cur"
    if not has_cur_slash and any(h in ("lineitemtype", "lineitemdescription", "lineitemusageaccountid")
                                  for h in cur_normed):
        return "cur"

    # Cost Explorer signature: recognizable cost + (service or usage type) column.
    has_cost = any(h in _CE_COST_ALIASES for h in normed)
    has_service_or_usage = any(h in _CE_SERVICE_ALIASES for h in normed) or \
        any(h in _CE_USAGE_TYPE_ALIASES for h in normed)
    if has_cost and has_service_or_usage:
        return "cost_explorer"

    return None


def _find_col(headers: list[str], normed: list[str], aliases: set[str]) -> int | None:
    for i, h in enumerate(normed):
        if h in aliases:
            return i
    return None


def _parse_amount(raw: str) -> float | None:
    if raw is None:
        return None
    s = raw.strip().strip('"').replace(",", "").replace("$", "")
    if s == "" or s.lower() in ("nan", "n/a", "-"):
        return None
    # Some exports wrap negative amounts (credits/refunds) in parens: (12.34)
    negative = s.startswith("(") and s.endswith(")")
    if negative:
        s = s[1:-1]
    try:
        val = float(s)
    except ValueError:
        return None
    return -val if negative else val


def _looks_like_total_row(first_cell: str) -> bool:
    c = (first_cell or "").strip().lower()
    return c in ("total", "totals", "grand total", "sum", "")


def parse_billing_csv(raw_bytes: bytes, filename: str | None = None) -> ParseResult:
    """Entry point. Accepts raw file bytes (not a path), returns a ParseResult.

    Never raises: any failure mode (empty file, undecodable bytes, no
    recognizable header, oversized file) comes back as ok=False with a
    human-readable `error`.
    """
    if raw_bytes is None or len(raw_bytes) == 0:
        return ParseResult(ok=False, error="The uploaded file is empty.")

    if len(raw_bytes) > MAX_BYTES:
        return ParseResult(
            ok=False,
            error=(
                f"File is too large ({len(raw_bytes) / (1024*1024):.1f} MB). "
                f"Max supported size is {MAX_BYTES // (1024*1024)} MB. "
                "Export a grouped summary (by Service/Usage Type) instead of a raw CUR dump."
            ),
        )

    # Decode defensively. AWS exports are UTF-8 (sometimes with BOM); be
    # tolerant of latin-1 fallback for hand-edited files rather than crashing.
    text: str | None = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = raw_bytes.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    if text is None:
        return ParseResult(ok=False, error="Could not decode the file as text. Please upload a CSV export.")

    text = _strip_bom(text)
    if not text.strip():
        return ParseResult(ok=False, error="The uploaded file has no content.")

    try:
        reader = csv.reader(io.StringIO(text))
        rows_iter = iter(reader)
        try:
            headers = next(rows_iter)
        except StopIteration:
            return ParseResult(ok=False, error="The CSV has no header row.")
    except csv.Error as e:
        return ParseResult(ok=False, error=f"Could not parse CSV structure: {e}")

    headers = [h for h in headers]  # keep raw for CUR tail-matching
    if not headers or all(not h.strip() for h in headers):
        return ParseResult(ok=False, error="The CSV header row is empty or unreadable.")

    fmt = _detect_format(headers)
    if fmt is None:
        return ParseResult(
            ok=False,
            error=(
                "Unrecognized CSV format. Expected an AWS Cost Explorer export "
                "(with Service/Usage Type + Cost columns) or a Cost & Usage Report "
                "export (lineItem/... columns)."
            ),
        )

    warnings: list[str] = []
    line_items: list[LineItem] = []
    rows_seen = 0
    rows_skipped = 0

    if fmt == "cost_explorer":
        normed = [_norm_header(h) for h in headers]
        idx_service = _find_col(headers, normed, _CE_SERVICE_ALIASES)
        idx_usage = _find_col(headers, normed, _CE_USAGE_TYPE_ALIASES)
        idx_region = _find_col(headers, normed, _CE_REGION_ALIASES)
        idx_cost = _find_col(headers, normed, _CE_COST_ALIASES)
        idx_desc = _find_col(headers, normed, _CE_DESCRIPTION_ALIASES)

        if idx_cost is None:
            return ParseResult(ok=False, error="Could not find a cost/amount column in the CSV.")
        if idx_service is None and idx_usage is None:
            return ParseResult(ok=False, error="Could not find a Service or Usage Type column in the CSV.")

        for row in rows_iter:
            rows_seen += 1
            if rows_seen > MAX_ROWS:
                warnings.append(f"File has more than {MAX_ROWS} rows; truncated for analysis.")
                break
            if not row or all((c or "").strip() == "" for c in row):
                continue
            if idx_cost >= len(row):
                rows_skipped += 1
                continue

            first_cell = row[0] if row else ""
            if _looks_like_total_row(first_cell) and (idx_service is None or idx_service == 0):
                # Common footer row: "Total,,,1234.56"  - skip, don't double count.
                rows_skipped += 1
                continue

            amount = _parse_amount(row[idx_cost])
            if amount is None:
                rows_skipped += 1
                continue

            service = row[idx_service].strip() if idx_service is not None and idx_service < len(row) else ""
            usage_type = row[idx_usage].strip() if idx_usage is not None and idx_usage < len(row) else ""
            region = row[idx_region].strip() if idx_region is not None and idx_region < len(row) else ""
            desc = row[idx_desc].strip() if idx_desc is not None and idx_desc < len(row) else ""

            if not service and not usage_type:
                rows_skipped += 1
                continue

            line_items.append(LineItem(
                service=service or "Unknown Service",
                usage_type=usage_type,
                region=region or "global",
                amount_usd=round(amount, 4),
                description=desc,
            ))

    else:  # fmt == "cur"
        cur_normed = [_norm_cur_col(h) for h in headers]
        idx_service = _find_col(headers, cur_normed, _CUR_SERVICE_COLS)
        idx_usage = _find_col(headers, cur_normed, _CUR_USAGE_TYPE_COLS)
        idx_region = _find_col(headers, cur_normed, _CUR_REGION_COLS)
        idx_cost = _find_col(headers, cur_normed, _CUR_COST_COLS)
        idx_desc = _find_col(headers, cur_normed, _CUR_DESCRIPTION_COLS)
        idx_record_type = _find_col(headers, cur_normed, _CUR_RECORD_TYPE_COLS)

        if idx_cost is None:
            return ParseResult(ok=False, error="Could not find lineItem/UnblendedCost in the CUR file.")
        if idx_service is None and idx_usage is None:
            return ParseResult(ok=False, error="Could not find product/ProductCode or lineItem/UsageType in the CUR file.")

        for row in rows_iter:
            rows_seen += 1
            if rows_seen > MAX_ROWS:
                warnings.append(f"File has more than {MAX_ROWS} rows; truncated for analysis.")
                break
            if not row or all((c or "").strip() == "" for c in row):
                continue
            if idx_cost >= len(row):
                rows_skipped += 1
                continue

            amount = _parse_amount(row[idx_cost])
            if amount is None:
                rows_skipped += 1
                continue

            record_type = row[idx_record_type].strip() if idx_record_type is not None and idx_record_type < len(row) else ""
            # CUR includes non-usage rows (Tax, Credit, Refund, Fee, ...). Skip
            # zero-amount rows outright; keep everything else but tag it via
            # record_type so the findings engine can decide what to do with it.
            if amount == 0:
                rows_skipped += 1
                continue

            service = row[idx_service].strip() if idx_service is not None and idx_service < len(row) else ""
            usage_type = row[idx_usage].strip() if idx_usage is not None and idx_usage < len(row) else ""
            region = row[idx_region].strip() if idx_region is not None and idx_region < len(row) else ""
            desc = row[idx_desc].strip() if idx_desc is not None and idx_desc < len(row) else ""

            if not service and not usage_type:
                rows_skipped += 1
                continue

            line_items.append(LineItem(
                service=service or "Unknown Service",
                usage_type=usage_type,
                region=region or "global",
                amount_usd=round(amount, 4),
                description=desc,
                record_type=record_type or "Usage",
            ))

    if not line_items:
        return ParseResult(
            ok=False,
            format=fmt,
            warnings=warnings,
            error="No usable cost rows were found in the file after parsing.",
            rows_seen=rows_seen,
            rows_skipped=rows_skipped,
        )

    return ParseResult(
        ok=True,
        format=fmt,
        line_items=line_items,
        warnings=warnings,
        rows_seen=rows_seen,
        rows_skipped=rows_skipped,
    )
