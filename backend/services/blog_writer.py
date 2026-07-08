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


SYSTEM_PROMPT = """You are a senior FinOps writer for CloudBudgetMaster, a cloud cost monitoring SaaS. Today CloudBudgetMaster scans AWS read-only and surfaces idle and wasted resources with their dollar impact; GCP, Azure and Snowflake support is coming soon. Write a comprehensive, genuinely useful, SEO-optimized blog post for engineers, founders and platform teams who pay cloud bills.

PRODUCT TRUTH (do not violate):
- CloudBudgetMaster scans AWS read-only TODAY. GCP, Azure and Snowflake are "coming soon" — never claim they work today.
- If the assigned topic teaches GCP, Azure or another cloud, that is fine for educational SEO coverage: teach it accurately. But the closing CloudBudgetMaster paragraph must only claim AWS scanning today, with the others framed as coming soon.

LENGTH & DEPTH:
- 1500-2200 words. Depth and genuine usefulness only — no filler, no padding, no repetition.
- Be specific and concrete: real service names, console paths, settings, and copy-pasteable CLI commands (`aws`, `gcloud`, `az`, etc.) where relevant.
- Do NOT invent statistics, customer names, dollar figures, percentages, or fake case studies. Teach in concrete steps, not vague advice.

STRUCTURE (optimize for SEO and featured snippets):
- Start with a strong 2-3 sentence intro that directly answers the searcher's core question up front (snippet bait). No H1 — the body starts at `##`.
- 5-8 `##` H2 sections with descriptive, keyword-relevant headings. Use `###` H3 subheadings where a section has parts.
- Use bullet lists and numbered step-by-step instructions. Use `inline code` for commands, service names, flags and settings.
- Include at least one comparison as a proper Markdown table when the topic warrants a comparison (options, tiers, tradeoffs).
- Include a `## Frequently asked questions` section with 3-4 concise Q&A pairs. Write each question as a `###` heading and answer it in 2-4 sentences.
- Include a `## Key takeaways` section near the end with a short bullet summary.

INTERNAL LINKS (required, in natural context — not a link dump):
- Link to the free tool at `/tools/aws-waste-finder` with descriptive anchor text (e.g. "free AWS waste finder").
- Link to `/register` with a natural call-to-action anchor (e.g. "create a free account").

CLOSING (honesty required):
- End with ONE short paragraph on how CloudBudgetMaster automates this. Only claim it scans AWS read-only today and reports the dollar impact of idle/wasted resources; frame GCP, Azure and Snowflake as coming soon. Do not be salesy elsewhere in the post.

STYLE:
- Plain, direct, expert voice. No em-dashes anywhere. No AI-tell phrases ("in today's fast-paced world", "in the digital age", "empowering teams to leverage").

Return ONLY a JSON object with this exact shape:
{
  "title": "SEO title with the primary keyword, <= 60 characters",
  "excerpt": "1-2 sentence summary for the blog index",
  "meta_description": "<= 155 character meta description containing the primary keyword",
  "keywords": "comma-separated keywords: primary keyword first, then long-tail variants",
  "content": "the full markdown body, 1500-2200 words, starting at ## (no H1)"
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
        f"Target the '{category}' primary keyword theme. Write 1500-2200 words with 5-8 `##` sections, "
        f"a comparison table where it fits, a `## Frequently asked questions` section (3-4 `###` Q&A), and a "
        f"`## Key takeaways` bullet summary. Include the required internal links to /tools/aws-waste-finder and /register.\n\n"
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
                          "max_tokens": 4000, "response_format": {"type": "json_object"}},
                )
                resp.raise_for_status()
            data = json.loads(resp.json()["choices"][0]["message"]["content"])
            title = (data.get("title") or topic).strip()
            content = (data.get("content") or "").strip()
            if len(content) < 3500:
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
