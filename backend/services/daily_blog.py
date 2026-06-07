"""Daily automated blog: generate a post, publish it, ping search engines, and
email opted-in subscribers. Driven by cron (backend/scripts/daily_blog.py) and by
the admin "Generate now" endpoint."""
import time
from datetime import datetime, timezone, timedelta

from backend.config import get_settings
from backend.core.security import make_unsub_token
from backend.core.email_service import send_new_post_notification
from backend.services.blog_writer import generate_post
from backend.services.blog_render import regenerate
from backend.services.search_ping import notify


def _published_recently(db, hours: int = 20) -> bool:
    rows = db.table("blog_posts").select("published_at").eq("status", "published") \
        .order("published_at", desc=True).execute().data or []
    if not rows or not rows[0].get("published_at"):
        return False
    try:
        last = datetime.fromisoformat(str(rows[0]["published_at"]).replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - last) < timedelta(hours=hours)
    except Exception:
        return False


def _email_subscribers(db, post: dict) -> int:
    s = get_settings()
    post_url = f"{s.site_url}/blog/{post['slug']}"
    users = db.table("profiles").select("id, email, blog_opt_out, email_verified") \
        .eq("email_verified", True).execute().data or []
    sent = 0
    for u in users:
        if u.get("blog_opt_out") or not u.get("email"):
            continue
        unsub = f"{s.site_url.replace('://', '://api.', 1)}/v1/blog/unsubscribe?token={make_unsub_token(u['id'])}"
        try:
            if send_new_post_notification(u["email"], post, post_url, unsub):
                sent += 1
            time.sleep(0.4)  # gentle on the SMTP relay
        except Exception as e:  # noqa: BLE001
            print(f"[daily_blog] email to {u['email']} failed: {e}")
    return sent


def run_daily(db, force: bool = False) -> dict:
    """Generate + publish today's post and email subscribers. Idempotent per day."""
    if not force and _published_recently(db):
        return {"status": "skipped", "reason": "a post was already published in the last 20h"}

    post = generate_post(db)  # raises on failure → cron logs, no junk published
    now = datetime.now(timezone.utc).isoformat()
    post["updated_at"] = now
    post["published_at"] = now

    # guard against an existing slug (rotation usually prevents this)
    if db.table("blog_posts").select("id").eq("slug", post["slug"]).execute().data:
        post["slug"] = f"{post['slug']}-{int(time.time())}"

    db.table("blog_posts").insert(post).execute()
    regenerate(db)
    notify([f"{get_settings().site_url}/blog/{post['slug']}", f"{get_settings().site_url}/blog"])
    emailed = _email_subscribers(db, post)
    return {"status": "published", "slug": post["slug"], "title": post["title"], "emailed": emailed}
