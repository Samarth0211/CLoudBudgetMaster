"""Render published blog posts to static, SEO-complete HTML.

The site is a client-rendered SPA, which is poor for SEO and breaks social link
previews (crawlers don't run JS). So whenever a post is published/edited, we
write a real static HTML file per post into the nginx-served dist/ directory,
each with its own <title>, meta description, canonical, OpenGraph/Twitter tags,
and JSON-LD BlogPosting — plus a blog index, sitemap.xml and robots.txt.

nginx's `try_files $uri $uri/ /index.html` serves dist/blog/<slug>/index.html
for direct/crawler hits; the SPA still handles in-app navigation.
"""
import os
import re
import html
import json
import shutil
from datetime import datetime, timezone

import markdown as md

from backend.config import get_settings

CATEGORIES = ["AWS", "GCP", "Azure", "FinOps", "Strategy"]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or "post"


def reading_time(content: str) -> str:
    words = len(re.findall(r"\w+", content or ""))
    return f"{max(1, round(words / 200))} min read"


def _iso(dt) -> str:
    """Return an ISO-8601 string for a datetime or already-ISO string."""
    if not dt:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def _human_date(dt) -> str:
    try:
        s = _iso(dt).replace("Z", "+00:00")
        return datetime.fromisoformat(s).strftime("%B %d, %Y")
    except Exception:
        return ""


def _e(s) -> str:
    """HTML-escape (incl. quotes) for safe attribute/text interpolation."""
    return html.escape(str(s or ""), quote=True)


# ── shared chrome ────────────────────────────────────────────────────────────
def _head(*, title, description, canonical, image, keywords="", og_type="website",
          published=None, category="", jsonld=None) -> str:
    s = get_settings()
    img = image or f"{s.site_url}/logo.png"
    extra = ""
    if og_type == "article" and published:
        extra += f'\n  <meta property="article:published_time" content="{_e(_iso(published))}" />'
        extra += f'\n  <meta property="article:author" content="CloudBudgetMaster" />'
        if category:
            extra += f'\n  <meta property="article:section" content="{_e(category)}" />'
    jsonld_tag = ""
    if jsonld:
        jsonld_tag = '\n  <script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{_e(title)}</title>
  <meta name="description" content="{_e(description)}" />
  <meta name="keywords" content="{_e(keywords)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="{_e(canonical)}" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <meta name="theme-color" content="#0B1220" />
  <meta property="og:site_name" content="CloudBudgetMaster" />
  <meta property="og:type" content="{og_type}" />
  <meta property="og:title" content="{_e(title)}" />
  <meta property="og:description" content="{_e(description)}" />
  <meta property="og:url" content="{_e(canonical)}" />
  <meta property="og:image" content="{_e(img)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{_e(title)}" />
  <meta name="twitter:description" content="{_e(description)}" />
  <meta name="twitter:image" content="{_e(img)}" />{extra}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" />{jsonld_tag}
  <style>{_CSS}</style>
</head>"""


_CSS = """
*{box-sizing:border-box}body{margin:0;background:#0B1220;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;line-height:1.65}
a{color:inherit;text-decoration:none}.wrap{max-width:760px;margin:0 auto;padding:0 24px}
header.site{border-bottom:1px solid #1e293b;background:rgba(11,18,32,.9);position:sticky;top:0;backdrop-filter:blur(8px);z-index:10}
header.site .row{max-width:1040px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:#fff}.brand img{width:28px;height:28px;border-radius:7px}
nav.top a{color:#94a3b8;font-size:14px;margin-left:20px}nav.top a:hover{color:#fff}
.btn{background:#FF9900;color:#1a1205!important;font-weight:600;padding:8px 16px;border-radius:9px;font-size:14px}
.cat{display:inline-block;border:1px solid #FF990033;background:#FF990014;color:#FF9900;font-size:11px;font-weight:600;padding:3px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em}
h1{color:#fff;font-size:34px;line-height:1.2;margin:18px 0 10px;font-weight:800}
h2{color:#fff;font-size:24px;margin:34px 0 12px;font-weight:700}h3{color:#fff;font-size:19px;margin:26px 0 8px}
article p{color:#cbd5e1;margin:14px 0}article ul,article ol{color:#cbd5e1;padding-left:22px}article li{margin:6px 0}
article a{color:#FF9900;text-decoration:underline}article img{max-width:100%;border-radius:12px;margin:18px 0}
article code{background:#1e293b;color:#fcd34d;padding:2px 6px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:.88em}
article pre{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;overflow-x:auto}
article pre code{background:none;color:#e2e8f0;padding:0}
article blockquote{border-left:3px solid #FF9900;margin:18px 0;padding:4px 0 4px 18px;color:#94a3b8}
article table{width:100%;border-collapse:collapse;margin:18px 0;font-size:14px}article th,article td{border:1px solid #1e293b;padding:8px 12px;text-align:left}article th{background:#111c2e;color:#fff}
.meta{color:#64748b;font-size:13px;margin:6px 0 22px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.cover{width:100%;border-radius:14px;margin:8px 0 6px}
.cta{margin:48px 0 16px;border:1px solid #1e293b;background:#111c2e;border-radius:16px;padding:28px;text-align:center}
.cta h3{margin:0 0 6px}.cta p{color:#94a3b8;margin:0 0 16px}
footer.site{border-top:1px solid #1e293b;margin-top:48px;color:#64748b;font-size:13px}
footer.site .row{max-width:1040px;margin:0 auto;padding:22px 24px;display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between}
footer.site a{color:#94a3b8}footer.site a:hover{color:#fff}
.card{display:block;border:1px solid #1e293b;background:#111c2e;border-radius:14px;padding:20px;margin:14px 0;transition:border-color .15s}
.card:hover{border-color:#334155}.card h2{font-size:19px;margin:8px 0 6px}.card p{color:#94a3b8;margin:0;font-size:14px}
.lede{color:#94a3b8;font-size:16px;margin:6px 0 28px}
"""


def _header() -> str:
    return """<header class="site"><div class="row">
  <a class="brand" href="/"><img src="/logo.png" alt="CloudBudgetMaster" />CloudBudgetMaster</a>
  <nav class="top"><a href="/">Home</a><a href="/blog">Blog</a><a href="/pricing">Pricing</a><a class="btn" href="/register">Start Free</a></nav>
</div></header>"""


def _footer() -> str:
    y = datetime.now(timezone.utc).year
    return f"""<footer class="site"><div class="row">
  <span>&copy; {y} CloudBudgetMaster. Multi-cloud cost monitoring.</span>
  <span><a href="/about">About</a> &nbsp; <a href="/pricing">Pricing</a> &nbsp; <a href="/privacy">Privacy</a> &nbsp; <a href="/terms">Terms</a> &nbsp; <a href="/contact">Contact</a></span>
</div></footer>"""


def _cta() -> str:
    return """<div class="cta">
  <h3>Stop guessing where your cloud money goes</h3>
  <p>CloudBudgetMaster scans AWS, GCP &amp; Azure and finds idle, unused, and overspending resources automatically.</p>
  <a class="btn" href="/register">Try Free — No Credit Card</a>
</div>"""


# ── pages ────────────────────────────────────────────────────────────────────
def render_post_html(post: dict) -> str:
    s = get_settings()
    slug = post["slug"]
    canonical = f"{s.site_url}/blog/{slug}"
    title_tag = f'{post["title"]} | CloudBudgetMaster'
    desc = post.get("meta_description") or post.get("excerpt") or post["title"]
    image = post.get("cover_image") or f"{s.site_url}/logo.png"
    body_html = md.markdown(post.get("content") or "", extensions=["fenced_code", "tables", "sane_lists"])
    jsonld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["title"],
        "description": desc,
        "image": [image],
        "datePublished": _iso(post.get("published_at") or post.get("created_at")),
        "dateModified": _iso(post.get("updated_at") or post.get("published_at")),
        "author": {"@type": "Organization", "name": post.get("author") or "CloudBudgetMaster", "url": s.site_url},
        "publisher": {"@type": "Organization", "name": "CloudBudgetMaster",
                      "logo": {"@type": "ImageObject", "url": f"{s.site_url}/logo.png"}},
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "articleSection": post.get("category") or "FinOps",
        "keywords": post.get("keywords") or "",
    }
    head = _head(title=title_tag, description=desc, canonical=canonical, image=image,
                 keywords=post.get("keywords", ""), og_type="article",
                 published=post.get("published_at") or post.get("created_at"),
                 category=post.get("category", ""), jsonld=jsonld)
    cover = f'<img class="cover" src="{_e(post["cover_image"])}" alt="{_e(post["title"])}" />' if post.get("cover_image") else ""
    return f"""{head}
<body>
{_header()}
<main class="wrap">
  <article>
    <p style="margin:26px 0 0"><a href="/blog" style="color:#64748b;font-size:13px">&larr; All articles</a></p>
    <span class="cat">{_e(post.get("category") or "FinOps")}</span>
    <h1>{_e(post["title"])}</h1>
    <div class="meta"><span>{_e(_human_date(post.get("published_at") or post.get("created_at")))}</span><span>&middot;</span><span>{_e(reading_time(post.get("content","")))}</span><span>&middot;</span><span>{_e(post.get("author") or "CloudBudgetMaster")}</span></div>
    {cover}
    {body_html}
  </article>
  {_cta()}
</main>
{_footer()}
</body>
</html>"""


def render_index_html(posts: list) -> str:
    s = get_settings()
    canonical = f"{s.site_url}/blog"
    cards = []
    for p in posts:
        cards.append(f"""<a class="card" href="/blog/{_e(p['slug'])}">
      <span class="cat">{_e(p.get('category') or 'FinOps')}</span>
      <h2>{_e(p['title'])}</h2>
      <p>{_e(p.get('excerpt') or p.get('meta_description') or '')}</p>
      <p style="color:#64748b;margin-top:10px;font-size:12px">{_e(_human_date(p.get('published_at') or p.get('created_at')))} &middot; {_e(reading_time(p.get('content','')))}</p>
    </a>""")
    body_list = "\n".join(cards) or '<p class="lede">New articles are on the way — check back soon.</p>'
    jsonld = {
        "@context": "https://schema.org", "@type": "Blog", "name": "CloudBudgetMaster Blog",
        "url": canonical, "description": "Practical guides on cloud cost optimization and FinOps.",
        "publisher": {"@type": "Organization", "name": "CloudBudgetMaster",
                      "logo": {"@type": "ImageObject", "url": f"{s.site_url}/logo.png"}},
    }
    head = _head(title="Cloud Cost Optimization Blog | CloudBudgetMaster",
                 description="Practical, actionable guides on cutting AWS, GCP and Azure costs — FinOps, waste detection, rightsizing, and cloud savings strategy.",
                 canonical=canonical, image=f"{s.site_url}/logo.png",
                 keywords="cloud cost optimization, FinOps, AWS cost savings, GCP cost, Azure cost, cloud waste",
                 jsonld=jsonld)
    return f"""{head}
<body>
{_header()}
<main class="wrap">
  <h1 style="margin-top:36px">Cloud Cost Optimization Blog</h1>
  <p class="lede">Practical, no-fluff guides on cutting your AWS, GCP and Azure bill — FinOps, waste detection, rightsizing, and real savings strategy.</p>
  {body_list}
  {_cta()}
</main>
{_footer()}
</body>
</html>"""


def render_sitemap(posts: list) -> str:
    s = get_settings()
    statics = ["/", "/pricing", "/about", "/blog", "/contact", "/security"]
    urls = [f"  <url><loc>{s.site_url}{p}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>" for p in statics]
    for p in posts:
        lm = _iso(p.get("updated_at") or p.get("published_at"))[:10]
        urls.append(f"  <url><loc>{s.site_url}/blog/{_e(p['slug'])}</loc><lastmod>{lm}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>")
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n"


def render_robots() -> str:
    s = get_settings()
    return f"User-agent: *\nAllow: /\n\nSitemap: {s.site_url}/sitemap.xml\n"


# ── filesystem sync ──────────────────────────────────────────────────────────
def regenerate(db) -> dict:
    """Rewrite all static blog HTML + sitemap + robots from current published posts.

    Idempotent and self-healing: prunes stale post directories. Safe to call on
    every blog mutation. No-ops (returns skipped) when blog_dist_dir is unset.
    """
    dist = get_settings().blog_dist_dir
    if not dist or not os.path.isdir(dist):
        return {"written": 0, "skipped": True, "reason": "blog_dist_dir unset or missing"}

    res = db.table("blog_posts").select("*").eq("status", "published").order("published_at", desc=True).execute()
    posts = res.data or []

    blog_dir = os.path.join(dist, "blog")
    os.makedirs(blog_dir, exist_ok=True)

    # write each post
    live_slugs = set()
    for p in posts:
        live_slugs.add(p["slug"])
        d = os.path.join(blog_dir, p["slug"])
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(render_post_html(p))

    # prune stale post dirs (slugs no longer published)
    for name in os.listdir(blog_dir):
        path = os.path.join(blog_dir, name)
        if os.path.isdir(path) and name not in live_slugs:
            shutil.rmtree(path, ignore_errors=True)

    # index, sitemap, robots
    with open(os.path.join(blog_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(render_index_html(posts))
    with open(os.path.join(dist, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(render_sitemap(posts))
    with open(os.path.join(dist, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(render_robots())

    return {"written": len(posts), "skipped": False}
