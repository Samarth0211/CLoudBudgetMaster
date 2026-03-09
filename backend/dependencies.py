from fastapi import Depends, HTTPException, Request
from backend.db.client import get_supabase


async def get_current_user(request: Request):
    """Validate JWT from Authorization header and return user profile."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    supabase = get_supabase()

    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Fetch profile from profiles table
    profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    return profile.data
