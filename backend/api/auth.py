from fastapi import APIRouter, HTTPException
from backend.db.client import get_supabase
from backend.models.user import RegisterRequest, LoginRequest, AuthResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest):
    supabase = get_supabase()

    try:
        auth_response = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {
                "data": {"full_name": body.full_name},
            },
        })
    except Exception as e:
        error_msg = str(e).lower()
        if "already registered" in error_msg or "already been registered" in error_msg:
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=400, detail=str(e))

    user = auth_response.user
    session = auth_response.session
    if not user:
        raise HTTPException(status_code=400, detail="Registration failed")

    # Session may be None if email confirmation is enabled
    if not session:
        raise HTTPException(
            status_code=400,
            detail="Please check your email to confirm your account, or disable email confirmation in Supabase Auth settings.",
        )

    # Insert profile row (using service role key bypasses RLS)
    try:
        supabase.table("profiles").upsert({
            "id": user.id,
            "email": body.email,
            "full_name": body.full_name,
            "plan": "free",
        }).execute()
    except Exception:
        # Profile insert failed but auth user was created — still return success
        pass

    return AuthResponse(
        id=user.id,
        email=body.email,
        full_name=body.full_name,
        plan="free",
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    supabase = get_supabase()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = auth_response.user
    session = auth_response.session
    if not user or not session:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Fetch or create profile
    try:
        profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        profile_data = profile.data or {}
    except Exception:
        # Profile doesn't exist yet — create it
        supabase.table("profiles").upsert({
            "id": user.id,
            "email": user.email,
            "full_name": user.user_metadata.get("full_name", "") if user.user_metadata else "",
            "plan": "free",
        }).execute()
        profile_data = {"full_name": "", "plan": "free"}

    return AuthResponse(
        id=user.id,
        email=user.email,
        full_name=profile_data.get("full_name"),
        plan=profile_data.get("plan", "free"),
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at,
    )


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}
