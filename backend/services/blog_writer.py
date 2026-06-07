"""Generate a full SEO blog post with an open-source LLM (GPT-OSS-120B on Groq).

Topics rotate through a curated, high-intent cloud-cost list (deterministic: the
first topic whose slug isn't already published is chosen), so coverage is broad
and nothing repeats. The model writes the title, excerpt, meta description,
keywords and markdown body; we keep the pre-defined slug + category for stability.
"""
import json
import httpx

from backend.config import get_settings
from backend.services.blog_render import slugify

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
FALLBACK_MODEL = "llama-3.3-70b-versatile"

# (topic, category) — ordered; the first unpublished one is written next.
SEED_TOPICS = [
    ("How to find and delete unattached EBS volumes draining your AWS bill", "AWS"),
    ("Right-sizing EC2 instances: a step-by-step guide to stop overpaying", "AWS"),
    ("Reserved Instances vs Savings Plans vs On-Demand: which saves more", "AWS"),
    ("Cut your S3 storage bill with lifecycle policies and storage classes", "AWS"),
    ("Finding idle RDS databases and how to right-size them safely", "AWS"),
    ("The hidden cost of unused Elastic IPs and NAT Gateways", "AWS"),
    ("GCP committed use discounts explained: how to actually save", "GCP"),
    ("Stop overpaying for Google Cloud persistent disks and snapshots", "GCP"),
    ("BigQuery cost control: slots, on-demand pricing, and query tuning", "GCP"),
    ("Azure Reserved VM Instances and Hybrid Benefit: a savings playbook", "Azure"),
    ("Cleaning up orphaned Azure managed disks and unused public IPs", "Azure"),
    ("What is FinOps and how a small team can adopt it this quarter", "FinOps"),
    ("Cloud cost allocation with tags: building a tagging strategy that sticks", "FinOps"),
    ("Showback vs chargeback: making engineering teams own their cloud spend", "FinOps"),
    ("How to set up cloud budget alerts that catch spikes before the invoice", "FinOps"),
    ("Kubernetes cost optimization: right-sizing pods and cluster autoscaling", "Strategy"),
    ("Spot instances 101: cutting compute costs by up to 90% safely", "AWS"),
    ("Data transfer and egress fees: the cloud bill line item everyone ignores", "Strategy"),
    ("Detecting zombie infrastructure: resources nobody remembers provisioning", "Strategy"),
    ("Monthly cloud cost review: a repeatable checklist for engineering leads", "FinOps"),
    ("CloudWatch and logging costs: how observability quietly inflates your bill", "AWS"),
    ("Auto-scaling vs over-provisioning: sizing for real demand, not peak", "Strategy"),
    ("Multi-cloud cost visibility: unifying AWS, GCP and Azure spend", "Strategy"),
    ("Serverless cost traps: when Lambda and Fargate get expensive", "AWS"),
    ("Negotiating an Enterprise Discount Program (EDP) with AWS", "Strategy"),
]


def _pick_topic(db) -> tuple[str, str, str]:
    """Return (topic, category, slug) for the first unpublished seed topic."""
    rows = db.table("blog_posts").select("slug").execute().data or []
    used = {r["slug"] for r in rows}
    for topic, category in SEED_TOPICS:
        slug = slugify(topic)[:80]
        if slug not in used:
            return topic, category, slug
    # all seeds used → let the model invent a fresh angle, deduped by slug
    topic = "An advanced cloud cost optimization tactic most teams overlook"
    base = slugify(topic)[:70]
    slug, i = base, 2
    while slug in used:
        slug = f"{base}-{i}"; i += 1
    return topic, "Strategy", slug


SYSTEM_PROMPT = """You are a senior FinOps writer for CloudBudgetMaster, a multi-cloud cost monitoring SaaS that scans AWS, GCP and Azure read-only and surfaces idle/wasted resources. Write a practical, genuinely useful blog post for engineers and founders who pay cloud bills.

RULES:
- 700-1000 words. Plain, direct, no fluff or filler.
- Use real service names, settings, and CLI commands where relevant; be specific and actionable.
- Do NOT invent statistics, customer names, or fake numbers. Speak in concrete steps, not vague advice.
- Structure with Markdown: 4-6 `##` section headings, bullet lists, occasional `inline code`.
- End with ONE short paragraph on how CloudBudgetMaster automates this (detects it automatically with the dollar impact). Do not be salesy elsewhere.

Return ONLY a JSON object:
{
  "title": "An SEO-friendly, specific title (<= 65 chars ideally)",
  "excerpt": "1-2 sentence summary for the blog index",
  "meta_description": "<=155 char meta description with the primary keyword",
  "keywords": "comma-separated SEO keywords",
  "content": "the full markdown body (no H1 — start at ##)"
}"""


def generate_post(db) -> dict:
    """Generate a publish-ready post dict, or raise on failure (never publish junk)."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY not set — cannot generate blog post")

    topic, category, slug = _pick_topic(db)
    recent = [r.get("title", "") for r in (db.table("blog_posts").select("title").execute().data or [])][:30]
    user_msg = (
        f"Write today's post on this topic:\n\n{topic}\n\n"
        f"Avoid overlapping with these existing titles: {', '.join(t for t in recent if t) or 'none yet'}."
    )
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_msg}]

    last_err = None
    for model in (settings.groq_report_model or FALLBACK_MODEL, FALLBACK_MODEL):
        try:
            with httpx.Client(timeout=90.0) as client:
                resp = client.post(
                    GROQ_API_URL,
                    headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": messages, "temperature": 0.5,
                          "max_tokens": 2600, "response_format": {"type": "json_object"}},
                )
                resp.raise_for_status()
            data = json.loads(resp.json()["choices"][0]["message"]["content"])
            title = (data.get("title") or topic).strip()
            content = (data.get("content") or "").strip()
            if len(content) < 400:
                raise ValueError("model returned too little content")
            return {
                "slug": slug,
                "title": title[:160],
                "excerpt": (data.get("excerpt") or "").strip()[:300],
                "meta_description": (data.get("meta_description") or data.get("excerpt") or "").strip()[:180],
                "keywords": (data.get("keywords") or "").strip()[:300],
                "category": category,
                "content": content,
                "author": "CloudBudgetMaster",
                "status": "published",
            }
        except Exception as e:  # noqa: BLE001
            last_err = e
            print(f"[blog_writer] model {model} failed: {e}")
    raise RuntimeError(f"blog generation failed: {last_err}")
