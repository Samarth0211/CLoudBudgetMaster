"""AI narrative generator for the client-ready cost report.

Uses the open-source Kimi K2 model (Moonshot) served on Groq's free tier — the
app already carries a Groq key, and we can't self-host a 1T-param model on the
VPS, so a hosted open-weights endpoint is the practical way to "use Kimi" here.

Produces three sections for the report:
  - executive_summary: a plain-language narrative a non-engineer can hand to a client
  - suggestions: prioritised, detailed remediation actions
  - faq: common questions a client asks about a cloud bill, pre-answered

Everything degrades gracefully: if there is no Groq key or the call fails, a
deterministic template builds the same shape from the numbers so the report is
never blank in production.
"""
import json
import httpx

from backend.config import get_settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
FALLBACK_MODEL = "llama-3.3-70b-versatile"


def _money(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def _context_block(ctx: dict) -> str:
    """Compact, factual brief the model must ground its narrative in."""
    services = ctx.get("services") or []
    svc_lines = "\n".join(
        f"  - {s.get('name', '?')}: {_money(s.get('cost'))} ({s.get('pct', 0)}%)"
        for s in services[:8]
    ) or "  (no per-service breakdown available)"

    waste = ctx.get("top_waste") or []
    waste_lines = "\n".join(
        f"  - {w.get('name', '?')} ({w.get('type', '')}): {_money(w.get('waste_monthly'))}/mo wasted"
        f" — {w.get('reason', 'idle/unused')}"
        for w in waste[:8]
    ) or "  (no waste detected)"

    top = ctx.get("top_resources") or []
    top_lines = "\n".join(
        f"  - {t.get('name', '?')} ({t.get('type', '')}, {t.get('region', '')}): {_money(t.get('monthly_cost'))}/mo"
        for t in top[:8]
    ) or "  (none)"

    return f"""ACCOUNT: {ctx.get('account_name') or 'Cloud account'}
CONNECTIONS SCANNED: {ctx.get('connection_count', 0)}
TOTAL RESOURCES: {ctx.get('resource_count', 0)} ({ctx.get('unused_count', 0)} idle/unused)

CURRENT MONTHLY SPEND: {_money(ctx.get('monthly_cost'))}
PROJECTED MONTH-END: {_money(ctx.get('projected_month_end')) if ctx.get('projected_month_end') is not None else 'n/a'}
WEEK-OVER-WEEK CHANGE: {ctx.get('wow_percent', 0)}%
MONTHLY WASTE: {_money(ctx.get('waste_cost'))}  ({ctx.get('waste_pct', 0)}% of spend)
ESTIMATED ANNUAL SAVINGS IF REMEDIATED: {_money(ctx.get('annual_savings'))}

TOP COST BY SERVICE:
{svc_lines}

BIGGEST WASTE ITEMS:
{waste_lines}

TOP RESOURCES BY COST:
{top_lines}"""


SYSTEM_PROMPT = """You are a senior FinOps (cloud financial operations) analyst writing the narrative for a client-ready cloud cost report. You are given a factual brief with exact numbers. Write for a business reader (a founder or finance lead), not an engineer.

STRICT RULES:
- Ground EVERY claim in the numbers provided. Never invent services, resources, or dollar amounts not in the brief.
- Quote real dollar figures from the brief when you make a point.
- Be specific and actionable. No fluff, no generic "consider optimizing" filler.
- If a number is missing/zero, say so plainly rather than guessing.

Return ONLY a JSON object with this exact shape:
{
  "executive_summary": "2-3 short paragraphs (plain text, no markdown) summarizing spend, the main cost drivers, waste, and the headline savings opportunity.",
  "suggestions": [
    {"title": "Short imperative action", "detail": "1-2 sentences: what to do, which resource/service, and the dollar impact.", "monthly_savings": 0.0}
  ],
  "faq": [
    {"q": "A question a client would actually ask about this bill", "a": "A direct, number-grounded answer."}
  ]
}
Provide 4-6 suggestions (ordered by dollar impact, biggest first) and 4-6 FAQ entries. monthly_savings is your best estimate in USD (use 0 if unknown)."""


def _fallback(ctx: dict) -> dict:
    """Deterministic, no-LLM version so the report always has content."""
    monthly = float(ctx.get("monthly_cost") or 0)
    waste = float(ctx.get("waste_cost") or 0)
    annual = float(ctx.get("annual_savings") or waste * 12)
    waste_pct = ctx.get("waste_pct", 0)
    services = ctx.get("services") or []
    top_waste = ctx.get("top_waste") or []

    top_svc = services[0] if services else None
    summary = (
        f"Across {ctx.get('connection_count', 0)} connection(s) and {ctx.get('resource_count', 0)} resources, "
        f"current monthly cloud spend is {_money(monthly)}. "
        + (f"The largest single driver is {top_svc.get('name')} at {_money(top_svc.get('cost'))} "
           f"({top_svc.get('pct', 0)}% of spend). " if top_svc else "")
        + f"Approximately {_money(waste)} per month ({waste_pct}%) is going to idle or unused resources, "
        f"which is about {_money(annual)} per year recoverable by acting on the items below."
    )
    suggestions = []
    for w in top_waste[:6]:
        suggestions.append({
            "title": f"Remediate {w.get('name', 'resource')}",
            "detail": (f"{w.get('type', 'Resource')} flagged as {w.get('reason', 'idle/unused')}; "
                       f"removing or right-sizing it saves about {_money(w.get('waste_monthly'))}/mo."),
            "monthly_savings": float(w.get("waste_monthly") or 0),
        })
    if not suggestions:
        suggestions.append({
            "title": "Review tagging coverage",
            "detail": "Add owner/environment tags so spend can be allocated and waste attributed.",
            "monthly_savings": 0.0,
        })
    faq = [
        {"q": "Why is my bill this high?",
         "a": f"Spend is {_money(monthly)}/mo." + (f" {top_svc.get('name')} alone is {_money(top_svc.get('cost'))}." if top_svc else "")},
        {"q": "How much can I save right now?",
         "a": f"About {_money(waste)}/mo ({_money(annual)}/yr) by acting on the {len(top_waste)} flagged item(s)."},
        {"q": "What should I do first?",
         "a": "Start with the highest-dollar waste item in the suggestions list — it has the biggest impact for the least effort."},
        {"q": "Is anything going to break if I remove these?",
         "a": "The flagged resources are idle or unused based on recent activity, but confirm with the owning team before deleting production resources."},
    ]
    return {"executive_summary": summary, "suggestions": suggestions, "faq": faq, "model": "rule-based"}


async def generate_report_insights(ctx: dict) -> dict:
    """Generate executive summary + suggestions + FAQ for the cost report."""
    settings = get_settings()
    api_key = settings.groq_api_key
    if not api_key:
        return _fallback(ctx)

    model = settings.groq_report_model or FALLBACK_MODEL
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "Write the report sections from this brief:\n\n" + _context_block(ctx)},
    ]

    for attempt_model in (model, FALLBACK_MODEL):
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(
                    GROQ_API_URL,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": attempt_model,
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 1800,
                        "response_format": {"type": "json_object"},
                    },
                )
                resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            # normalise shape
            out = {
                "executive_summary": str(data.get("executive_summary", "")).strip() or _fallback(ctx)["executive_summary"],
                "suggestions": [
                    {
                        "title": str(s.get("title", "")).strip(),
                        "detail": str(s.get("detail", "")).strip(),
                        "monthly_savings": float(s.get("monthly_savings") or 0),
                    }
                    for s in (data.get("suggestions") or []) if s.get("title") or s.get("detail")
                ][:6],
                "faq": [
                    {"q": str(f.get("q", "")).strip(), "a": str(f.get("a", "")).strip()}
                    for f in (data.get("faq") or []) if f.get("q") and f.get("a")
                ][:6],
                "model": attempt_model,
            }
            if not out["suggestions"]:
                out["suggestions"] = _fallback(ctx)["suggestions"]
            if not out["faq"]:
                out["faq"] = _fallback(ctx)["faq"]
            return out
        except Exception as e:  # noqa: BLE001
            print(f"[AI Report] model {attempt_model} failed: {e}")
            if attempt_model == FALLBACK_MODEL:
                break
    return _fallback(ctx)
