from datetime import datetime, timezone
from fastapi import HTTPException, Request, Depends
from backend.db.client import get_db
from backend.core.security import decode_token
from backend.config import get_settings


async def get_current_user(request: Request):
    """Validate our JWT from the Authorization header and return the user's profile."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = get_db()
    profile = db.table("profiles").select("*").eq("id", user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    data = profile.data

    # Lazily expire promo/paid trials: once plan_expires_at passes, drop to free.
    # Enforced on every authenticated request, so no cron is required to be correct.
    exp = data.get("plan_expires_at")
    if exp and data.get("plan") != "free":
        expd = exp if hasattr(exp, "tzinfo") else datetime.fromisoformat(str(exp))
        if expd.tzinfo is None:
            expd = expd.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expd:
            db.table("profiles").update({"plan": "free", "plan_expires_at": None}).eq("id", user_id).execute()
            data["plan"] = "free"
            data["plan_expires_at"] = None

    return data


async def require_admin(user=Depends(get_current_user)):
    """Allow only emails listed in ADMIN_EMAILS (comma-separated) to manage the blog."""
    admins = [e.strip().lower() for e in (get_settings().admin_emails or "").split(",") if e.strip()]
    if not admins or (user.get("email") or "").lower() not in admins:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
