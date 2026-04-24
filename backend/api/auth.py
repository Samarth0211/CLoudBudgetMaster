import re
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.db.client import get_supabase
from backend.models.user import RegisterRequest, LoginRequest, AuthResponse
from backend.dependencies import get_current_user
from backend.core.email_service import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory OTP store
_pending_otps: dict = {}

COMMON_PASSWORDS = {
    "123456", "password", "12345678", "qwerty", "123456789", "12345",
    "1234", "111111", "1234567", "dragon", "123123", "abc123",
    "football", "monkey", "letmein", "shadow", "master", "666666",
    "qwertyuiop", "123321", "mustang", "654321", "superman", "1qaz2wsx",
    "7777777", "121212", "000000", "trustno1", "iloveyou", "sunshine",
    "princess", "welcome", "admin", "passw0rd", "p@ssword", "pass123",
    "changeme", "baseball", "starwars", "batman", "access", "hello",
}


def validate_password(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if password.lower() in COMMON_PASSWORDS:
        return "This password is too common — choose a stronger one"
    if password.isdigit():
        return "Password cannot be all numbers"
    if not re.search(r'[A-Za-z]', password):
        return "Password must contain at least one letter"
    if not re.search(r'[0-9]', password):
        return "Password must contain at least one number"
    return None


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    """Validate password, create user, send OTP email. Tokens returned after OTP verification."""
    pw_error = validate_password(body.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    supabase = get_supabase()

    try:
        auth_response = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"full_name": body.full_name}},
        })
    except Exception as e:
        error_msg = str(e).lower()
        if "already registered" in error_msg or "already been registered" in error_msg:
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=400, detail=str(e))

    user = auth_response.user
    if not user:
        raise HTTPException(status_code=400, detail="Registration failed")

    # Insert profile
    try:
        supabase.table("profiles").upsert({
            "id": user.id,
            "email": body.email,
            "full_name": body.full_name,
            "plan": "free",
        }).execute()
    except Exception:
        pass

    # Generate and send OTP
    code = f"{secrets.randbelow(900000) + 100000}"
    _pending_otps[body.email.lower()] = {
        "code": code,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
    }

    send_verification_email(body.email, code, body.full_name)

    return {"message": "Verification code sent to your email", "requires_verification": True}


class VerifyOTPRequest(BaseModel):
    email: str
    code: str
    password: str  # Frontend resends password so we can auto-login after verification


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(body: VerifyOTPRequest):
    """Verify OTP, then sign in and return tokens."""
    email_key = body.email.lower()
    otp_data = _pending_otps.get(email_key)

    if not otp_data:
        raise HTTPException(status_code=400, detail="No pending verification. Please register again.")

    if datetime.now(timezone.utc) > otp_data["expires"]:
        _pending_otps.pop(email_key, None)
        raise HTTPException(status_code=400, detail="Code expired. Please register again.")

    if body.code.strip() != otp_data["code"]:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    _pending_otps.pop(email_key, None)

    # OTP valid — now sign in
    supabase = get_supabase()
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Verification succeeded but login failed. Try signing in manually.")

    user = auth_response.user
    session = auth_response.session
    if not user or not session:
        raise HTTPException(status_code=401, detail="Verification succeeded but login failed. Try signing in manually.")

    try:
        profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        profile_data = profile.data or {}
    except Exception:
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

    try:
        profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        profile_data = profile.data or {}
    except Exception:
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


# In-memory reset OTP store
_pending_resets: dict = {}


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """Generate reset code and send via our SMTP."""
    code = f"{secrets.randbelow(900000) + 100000}"
    email_key = body.email.lower()

    _pending_resets[email_key] = {
        "code": code,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
    }

    # Send email (don't reveal if account exists)
    send_password_reset_email(body.email, code)

    return {"message": "If an account with that email exists, a reset code has been sent."}


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """Verify reset code and update password."""
    pw_error = validate_password(body.new_password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    email_key = body.email.lower()
    reset_data = _pending_resets.get(email_key)

    if not reset_data:
        raise HTTPException(status_code=400, detail="No pending reset for this email. Request a new code.")

    if datetime.now(timezone.utc) > reset_data["expires"]:
        _pending_resets.pop(email_key, None)
        raise HTTPException(status_code=400, detail="Reset code expired. Request a new one.")

    if body.code.strip() != reset_data["code"]:
        raise HTTPException(status_code=400, detail="Invalid reset code")

    _pending_resets.pop(email_key, None)

    # Update password via Supabase admin API
    supabase = get_supabase()
    try:
        # Find user by email
        users = supabase.auth.admin.list_users()
        target_user = None
        for u in users:
            if hasattr(u, 'email') and u.email and u.email.lower() == email_key:
                target_user = u
                break

        if not target_user:
            raise HTTPException(status_code=400, detail="Account not found")

        supabase.auth.admin.update_user_by_id(target_user.id, {"password": body.new_password})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update password: {str(e)[:200]}")

    return {"message": "Password updated successfully. You can now sign in."}


class UpdateProfileRequest(BaseModel):
    full_name: str


@router.put("/profile")
async def update_profile(body: UpdateProfileRequest, user=Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("profiles").update({"full_name": body.full_name}).eq("id", user["id"]).execute()
    return {"message": "Profile updated"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, user=Depends(get_current_user)):
    pw_error = validate_password(body.new_password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    supabase = get_supabase()

    # Verify current password by attempting sign-in
    try:
        supabase.auth.sign_in_with_password({"email": user["email"], "password": body.current_password})
    except Exception:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Update password
    try:
        supabase.auth.admin.update_user_by_id(user["id"], {"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update password: {str(e)[:200]}")

    return {"message": "Password updated successfully"}


@router.delete("/account")
async def delete_account(user=Depends(get_current_user)):
    supabase = get_supabase()

    # Delete user data
    try:
        supabase.table("resources").delete().eq("connection_id",
            supabase.table("cloud_connections").select("id").eq("user_id", user["id"]).execute().data[0]["id"]
            if supabase.table("cloud_connections").select("id").eq("user_id", user["id"]).execute().data else "none"
        ).execute()
    except Exception:
        pass

    try:
        supabase.table("cloud_connections").delete().eq("user_id", user["id"]).execute()
        supabase.table("alert_rules").delete().eq("user_id", user["id"]).execute()
        supabase.table("alert_events").delete().eq("user_id", user["id"]).execute()
        supabase.table("profiles").delete().eq("id", user["id"]).execute()
    except Exception:
        pass

    # Delete auth user
    try:
        supabase.auth.admin.delete_user(user["id"])
    except Exception:
        pass

    return {"message": "Account deleted"}


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}
