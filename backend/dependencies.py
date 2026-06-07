from fastapi import HTTPException, Request
from backend.db.client import get_supabase
from backend.core.security import decode_token


async def get_current_user(request: Request):
    """Validate our JWT from the Authorization header and return the user's profile."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    supabase = get_supabase()
    profile = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    return profile.data
