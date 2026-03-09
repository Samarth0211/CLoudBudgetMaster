from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    plan: str
    access_token: str
    refresh_token: str
    expires_at: int


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    plan: str
    created_at: str
