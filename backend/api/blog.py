"""Blog API: public read endpoints + admin-only CRUD.

Mutations re-render the static SEO HTML (see services/blog_render). Mounted at
/v1/blog. Public pages are served as static files from the nginx dist.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from backend.db.client import get_db
from backend.config import get_settings
from backend.dependencies import require_admin
from backend.services.blog_render import regenerate, slugify, reading_time, CATEGORIES
from backend.services.search_ping import notify

router = APIRouter(prefix="/blog", tags=["blog"])

_PUBLIC_COLS = "id, slug, title, excerpt, category, cover_image, author, published_at, content"


class PostIn(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: str = ""
    content: str = ""
    category: str = "FinOps"
    cover_image: str = ""
    meta_description: str = ""
    keywords: str = ""
    status: str = "draft"  # draft | published


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _regen(db):
    try:
        regenerate(db)
    except Exception as e:  # noqa: BLE001 — static regen must never fail the API
        print(f"[blog] static regen failed: {e}")


def _ping_if_published(post: dict):
    """Notify search engines about a newly published/updated post."""
    if not post or post.get("status") != "published":
        return
    base = get_settings().site_url
    notify([f"{base}/blog/{post['slug']}", f"{base}/blog"])


def _unique_slug(db, base: str, exclude_id: Optional[str] = None) -> str:
    base = slugify(base)
    rows = db.table("blog_posts").select("id, slug").execute().data or []
    taken = {r["slug"] for r in rows if r.get("id") != exclude_id}
    if base not in taken:
        return base
    i = 2
    while f"{base}-{i}" in taken:
        i += 1
    return f"{base}-{i}"


def _get_by(db, col, val):
    return db.table("blog_posts").select("*").eq(col, val).single().execute().data


# ── public ───────────────────────────────────────────────────────────────────
@router.get("/posts")
async def list_published(limit: int = 50):
    db = get_db()
    rows = db.table("blog_posts").select(_PUBLIC_COLS) \
        .eq("status", "published").order("published_at", desc=True).execute().data or []
    for r in rows:
        r["read_time"] = reading_time(r.pop("content", ""))
    return {"posts": rows[: max(1, min(limit, 100))]}


@router.get("/posts/{slug}")
async def get_published(slug: str):
    db = get_db()
    row = db.table("blog_posts").select("*").eq("slug", slug).eq("status", "published").single().execute().data
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    row["read_time"] = reading_time(row.get("content", ""))
    return row


@router.get("/categories")
async def categories():
    return {"categories": CATEGORIES}


# ── admin ────────────────────────────────────────────────────────────────────
@router.get("/admin/posts")
async def admin_list(admin=Depends(require_admin)):
    db = get_db()
    rows = db.table("blog_posts").select("id, slug, title, category, status, published_at, updated_at, excerpt") \
        .order("updated_at", desc=True).execute().data or []
    return {"posts": rows}


@router.get("/admin/posts/{post_id}")
async def admin_get(post_id: str, admin=Depends(require_admin)):
    db = get_db()
    row = _get_by(db, "id", post_id)
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return row


@router.post("/admin/posts")
async def admin_create(body: PostIn, admin=Depends(require_admin)):
    db = get_db()
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    slug = _unique_slug(db, body.slug or body.title)
    status = body.status if body.status in ("draft", "published") else "draft"
    row = {
        "slug": slug, "title": body.title.strip(), "excerpt": body.excerpt,
        "content": body.content, "category": body.category, "cover_image": body.cover_image,
        "meta_description": body.meta_description, "keywords": body.keywords,
        "status": status, "updated_at": _now(),
    }
    if status == "published":
        row["published_at"] = _now()
    db.table("blog_posts").insert(row).execute()
    _regen(db)
    out = _get_by(db, "slug", slug)
    _ping_if_published(out)
    return out


@router.put("/admin/posts/{post_id}")
async def admin_update(post_id: str, body: PostIn, admin=Depends(require_admin)):
    db = get_db()
    existing = _get_by(db, "id", post_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Post not found")
    slug = existing["slug"]
    desired = slugify(body.slug or body.title or existing["slug"])
    if desired != existing["slug"]:
        slug = _unique_slug(db, desired, exclude_id=post_id)
    status = body.status if body.status in ("draft", "published") else existing["status"]
    upd = {
        "slug": slug, "title": body.title.strip() or existing["title"], "excerpt": body.excerpt,
        "content": body.content, "category": body.category, "cover_image": body.cover_image,
        "meta_description": body.meta_description, "keywords": body.keywords,
        "status": status, "updated_at": _now(),
    }
    if status == "published" and not existing.get("published_at"):
        upd["published_at"] = _now()
    db.table("blog_posts").update(upd).eq("id", post_id).execute()
    _regen(db)
    out = _get_by(db, "id", post_id)
    _ping_if_published(out)
    return out


@router.delete("/admin/posts/{post_id}")
async def admin_delete(post_id: str, admin=Depends(require_admin)):
    db = get_db()
    db.table("blog_posts").delete().eq("id", post_id).execute()
    _regen(db)
    return {"ok": True}


@router.post("/admin/regenerate")
async def admin_regenerate(admin=Depends(require_admin)):
    db = get_db()
    from backend.services.blog_render import regenerate as _r
    return _r(db)
