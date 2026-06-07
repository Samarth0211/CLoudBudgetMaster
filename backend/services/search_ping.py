"""Notify search engines when a post is published/updated.

- IndexNow (https://www.indexnow.org): one POST submits URLs to Bing, Yandex,
  Seznam, Naver instantly. Google is evaluating IndexNow but doesn't consume it
  yet. Needs INDEXNOW_KEY set; the key is also served as /<key>.txt (written by
  blog_render.regenerate) so engines can verify ownership.
- Google Indexing API: officially supports JobPosting/BroadcastEvent only, but we
  expose it for completeness. Activates only when GOOGLE_INDEXING_SA_FILE points
  to a service-account JSON whose account is a Search Console owner.

Everything is best-effort and runs in a daemon thread so publishing never blocks.
"""
import json
import threading
from urllib.parse import urlparse

import httpx

from backend.config import get_settings


def _indexnow(urls: list[str]) -> None:
    s = get_settings()
    if not s.indexnow_key or not urls:
        return
    host = urlparse(s.site_url).netloc
    payload = {
        "host": host,
        "key": s.indexnow_key,
        "keyLocation": f"{s.site_url}/{s.indexnow_key}.txt",
        "urlList": urls,
    }
    try:
        r = httpx.post("https://api.indexnow.org/indexnow", json=payload,
                       headers={"Content-Type": "application/json"}, timeout=10.0)
        print(f"[ping] IndexNow {r.status_code} for {len(urls)} url(s)")
    except Exception as e:  # noqa: BLE001
        print(f"[ping] IndexNow failed: {e}")


def _google(urls: list[str]) -> None:
    s = get_settings()
    if not s.google_indexing_sa_file or not urls:
        return
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import AuthorizedSession
        creds = service_account.Credentials.from_service_account_file(
            s.google_indexing_sa_file, scopes=["https://www.googleapis.com/auth/indexing"])
        session = AuthorizedSession(creds)
        for u in urls:
            resp = session.post("https://indexing.googleapis.com/v3/urlNotifications:publish",
                                data=json.dumps({"url": u, "type": "URL_UPDATED"}),
                                headers={"Content-Type": "application/json"}, timeout=10.0)
            print(f"[ping] Google Indexing {resp.status_code} for {u}")
    except Exception as e:  # noqa: BLE001
        print(f"[ping] Google Indexing failed: {e}")


def _run(urls: list[str]) -> None:
    _indexnow(urls)
    _google(urls)


def notify(urls: list[str]) -> None:
    """Fire-and-forget search-engine ping for the given URLs."""
    urls = [u for u in (urls or []) if u]
    if not urls:
        return
    threading.Thread(target=_run, args=(urls,), daemon=True).start()
