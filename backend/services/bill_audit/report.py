"""Renders a FindingsReport into a clean, self-contained HTML report.

No external assets (fonts/CSS/JS) are loaded, so this can be handed straight
to a PDF renderer later (e.g. a headless-browser print) without extra plumbing.
AWS-only, honest framing: no GCP/Azure claims, no em-dashes, illustrative /
non-exact figures are labeled inline rather than presented as certainties.
"""
from __future__ import annotations

import html
from datetime import datetime, timezone

from backend.services.bill_audit.analyze import FindingsReport, CategoryReport, Finding

_CONFIDENCE_BADGE = {
    "confirmed": ("Confirmed in bill", "#1a7f37"),
    "likely": ("Likely (bill signal)", "#9a6700"),
    "potential": ("Potential (needs live scan)", "#9a6700"),
}


def _esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def _money(v: float) -> str:
    sign = "-" if v < 0 else ""
    return f"{sign}${abs(v):,.2f}"


def _finding_row(f: Finding) -> str:
    badge_label, badge_color = _CONFIDENCE_BADGE.get(f.confidence, ("", "#666"))
    return f"""
    <tr>
      <td>{_esc(f.service)}</td>
      <td>{_esc(f.usage_type or '-')}</td>
      <td>{_esc(f.region or '-')}</td>
      <td class="num">{_money(f.monthly_usd)}</td>
      <td><span class="badge" style="color:{badge_color};border-color:{badge_color}">{_esc(badge_label)}</span></td>
      <td class="note">{_esc(f.note)}</td>
    </tr>"""


def _category_block(cat: CategoryReport) -> str:
    if not cat.findings:
        body = '<p class="empty">No line items matched this category in the uploaded CSV.</p>'
    else:
        rows = "\n".join(_finding_row(f) for f in cat.findings)
        body = f"""
        <table>
          <thead>
            <tr><th>Service</th><th>Usage type</th><th>Region</th><th class="num">$/month</th><th>Confidence</th><th>Note</th></tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>"""

    extra = f'<p class="cat-note">{_esc(cat.extra_note)}</p>' if cat.extra_note else ""

    return f"""
    <section class="category">
      <div class="cat-header">
        <h2>{_esc(cat.label)}</h2>
        <div class="cat-total">{_money(cat.total_usd)}<span>/month</span></div>
      </div>
      {extra}
      {body}
    </section>"""


def render_html_report(report: FindingsReport, *, account_label: str | None = None,
                        source_filename: str | None = None) -> str:
    """Render the findings report to a self-contained HTML string.

    `account_label` / `source_filename` are optional display-only strings
    (e.g. "AWS account ending 4821", "cost-explorer-june.csv") -- purely
    cosmetic, never used in any calculation.
    """
    generated_at = datetime.now(timezone.utc).strftime("%B %d, %Y %H:%M UTC")
    subtitle_bits = []
    if account_label:
        subtitle_bits.append(_esc(account_label))
    if source_filename:
        subtitle_bits.append(f"source file: {_esc(source_filename)}")
    subtitle = " &middot; ".join(subtitle_bits)

    category_html = "\n".join(_category_block(c) for c in report.categories)

    warnings_html = ""
    if report.warnings:
        items = "".join(f"<li>{_esc(w)}</li>" for w in report.warnings)
        warnings_html = f'<div class="warnings"><strong>Notes on this file:</strong><ul>{items}</ul></div>'

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AWS Bill Health Check</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 32px; background: #ffffff; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }}
  .wrap {{ max-width: 920px; margin: 0 auto; }}
  header.report-header {{ border-bottom: 3px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }}
  header.report-header h1 {{ margin: 0 0 4px 0; font-size: 26px; }}
  header.report-header .meta {{ color: #666; font-size: 13px; }}
  .aws-tag {{
    display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase; color: #b45309; background: #fef3c7; border: 1px solid #f5d68a;
    border-radius: 4px; padding: 2px 8px; margin-bottom: 10px;
  }}
  .totals {{ display: flex; gap: 16px; margin: 20px 0 28px 0; flex-wrap: wrap; }}
  .totals .tile {{ flex: 1 1 220px; border: 1px solid #e2e2e2; border-radius: 8px; padding: 16px; background: #fafafa; }}
  .totals .tile .label {{ font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.03em; }}
  .totals .tile .value {{ font-size: 28px; font-weight: 700; margin-top: 4px; }}
  .totals .tile.flagged .value {{ color: #b42318; }}
  .totals .tile .sub {{ font-size: 12px; color: #888; margin-top: 4px; }}
  section.category {{ margin-bottom: 32px; border: 1px solid #e2e2e2; border-radius: 8px; overflow: hidden; }}
  .cat-header {{
    display: flex; justify-content: space-between; align-items: baseline;
    background: #f5f5f5; padding: 14px 18px; border-bottom: 1px solid #e2e2e2;
  }}
  .cat-header h2 {{ margin: 0; font-size: 17px; }}
  .cat-total {{ font-size: 18px; font-weight: 700; }}
  .cat-total span {{ font-size: 12px; font-weight: 400; color: #666; margin-left: 2px; }}
  .cat-note {{ margin: 12px 18px 0 18px; font-size: 13px; color: #555; font-style: italic; }}
  .empty {{ margin: 16px 18px; color: #888; font-size: 13px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }}
  thead th {{
    text-align: left; padding: 8px 18px; background: #fbfbfb; border-bottom: 1px solid #e2e2e2;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #666;
  }}
  tbody td {{ padding: 9px 18px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }}
  tbody tr:last-child td {{ border-bottom: none; }}
  td.num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
  th.num {{ text-align: right; }}
  td.note {{ color: #555; max-width: 320px; }}
  .badge {{
    display: inline-block; font-size: 11px; font-weight: 600; border: 1px solid; border-radius: 999px;
    padding: 1px 8px; white-space: nowrap;
  }}
  .warnings {{ background: #fff8e6; border: 1px solid #f5d68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; }}
  .warnings ul {{ margin: 6px 0 0 18px; padding: 0; }}
  .disclaimer {{ margin-top: 32px; padding: 14px 18px; background: #f5f5f5; border-radius: 8px; font-size: 12px; color: #555; }}
  footer {{ margin-top: 24px; font-size: 11px; color: #999; text-align: center; }}
</style>
</head>
<body>
<div class="wrap">
  <header class="report-header">
    <div class="aws-tag">AWS only</div>
    <h1>AWS Bill Health Check</h1>
    <div class="meta">Generated {generated_at}{" &middot; " + subtitle if subtitle else ""}</div>
  </header>

  {warnings_html}

  <div class="totals">
    <div class="tile">
      <div class="label">Total spend (from CSV)</div>
      <div class="value">{_money(report.total_spend_usd)}</div>
      <div class="sub">{report.line_item_count} line items analyzed</div>
    </div>
    <div class="tile flagged">
      <div class="label">Total flagged</div>
      <div class="value">{_money(report.total_flagged_usd)}</div>
      <div class="sub">{_money(report.total_flagged_confirmed_usd)} confirmed + {_money(report.total_flagged_potential_usd)} likely/potential</div>
    </div>
  </div>

  {category_html}

  <div class="disclaimer">
    <strong>How to read this report.</strong> All dollar figures come directly from your
    uploaded billing CSV -- nothing here is fabricated or estimated beyond what AWS itself
    billed. Findings marked <em>Likely</em> or <em>Potential</em> are inferred from usage-type
    naming and cannot be proven idle, unattached, or stopped from billing data alone; a live
    read-only account scan confirms those exactly (CPU/connection metrics, attachment state,
    instance status). This report covers AWS only.
  </div>

  <footer>CloudBudgetMaster AWS Bill Health Check</footer>
</div>
</body>
</html>"""
