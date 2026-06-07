import re
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from backend.db.client import get_db
from backend.models.user import RegisterRequest, LoginRequest, AuthResponse
from backend.dependencies import get_current_user
from backend.core.email_service import send_verification_email, send_password_reset_email
from backend.core.rate_limit import limiter
from backend.core.otp_store import set_code, verify_code
from backend.core.security import hash_password, verify_password, issue_token

router = APIRouter(prefix="/auth", tags=["auth"])

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


def _auth_response(profile: dict) -> AuthResponse:
    token, exp = issue_token(profile["id"])
    return AuthResponse(
        id=profile["id"],
        email=profile["email"],
        full_name=profile.get("full_name"),
        plan=profile.get("plan", "free"),
        access_token=token,
        refresh_token=token,
        expires_at=exp,
    )


@router.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    pw_error = validate_password(body.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    email = str(body.email).lower().strip()
    db = get_db()

    existing = db.table("profiles").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Email already registered")

    db.table("profiles").insert({
        "email": email,
        "full_name": body.full_name,
        "password_hash": hash_password(body.password),
        "plan": "free",
        "email_verified": False,
    }).execute()

    code = f"{secrets.randbelow(900000) + 100000}"
    set_code(email, "verify", code)
    send_verification_email(email, code, body.full_name)
    return {"message": "Verification code sent to your email", "requires_verification": True}


class VerifyOTPRequest(BaseModel):
    email: str
    code: str
    password: str = ""  # accepted for frontend compatibility; unused


@router.post("/verify-otp", response_model=AuthResponse)
@limiter.limit("10/minute")
async def verify_otp(request: Request, body: VerifyOTPRequest):
    email = body.email.lower().strip()
    ok, err = verify_code(email, "verify", body.code)
    if not ok:
        raise HTTPException(status_code=400, detail=err)

    db = get_db()
    db.table("profiles").update({"email_verified": True}).eq("email", email).execute()
    profile = db.table("profiles").select("*").eq("email", email).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Account not found")
    return _auth_response(profile.data)


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest):
    email = str(body.email).lower().strip()
    db = get_db()
    profile = db.table("profiles").select("*").eq("email", email).single().execute()

    if not profile.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, profile.data.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not profile.data.get("email_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")

    return _auth_response(profile.data)


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
@limiter.limit("4/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    email = body.email.lower().strip()
    code = f"{secrets.randbelow(900000) + 100000}"
    set_code(email, "reset", code)
    # Don't reveal whether the account exists.
    send_password_reset_email(email, code)
    return {"message": "If an account with that email exists, a reset code has been sent."}


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, body: ResetPasswordRequest):
    pw_error = validate_password(body.new_password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    email = body.email.lower().strip()
    ok, err = verify_code(email, "reset", body.code)
    if not ok:
        raise HTTPException(status_code=400, detail=err)

    db = get_db()
    res = db.table("profiles").update({"password_hash": hash_password(body.new_password)}).eq("email", email).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Account not found")
    return {"message": "Password updated successfully. You can now sign in."}


class UpdateProfileRequest(BaseModel):
    full_name: str


@router.put("/profile")
async def update_profile(body: UpdateProfileRequest, user=Depends(get_current_user)):
    db = get_db()
    db.table("profiles").update({"full_name": body.full_name}).eq("id", user["id"]).execute()
    return {"message": "Profile updated"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
@limiter.limit("10/minute")
async def change_password(request: Request, body: ChangePasswordRequest, user=Depends(get_current_user)):
    pw_error = validate_password(body.new_password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)
    if not verify_password(body.current_password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    db = get_db()
    db.table("profiles").update({"password_hash": hash_password(body.new_password)}).eq("id", user["id"]).execute()
    return {"message": "Password updated successfully"}


@router.delete("/account")
async def delete_account(user=Depends(get_current_user)):
    db = get_db()
    # FK cascades remove connections, resources, alerts, etc.
    db.table("profiles").delete().eq("id", user["id"]).execute()
    return {"message": "Account deleted"}


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}
