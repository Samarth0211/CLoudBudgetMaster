"""Self-hosted auth primitives: bcrypt password hashing + HS256 JWTs."""
import time
import bcrypt
import jwt
from backend.config import get_settings


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes; truncate explicitly (bcrypt 5 errors otherwise).
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    s = get_settings()
    return s.jwt_secret or s.credential_encryption_key


def issue_token(user_id: str, hours: int = 168) -> tuple[str, int]:
    """Return (jwt, expires_at_unix). Default 7-day expiry."""
    now = int(time.time())
    exp = now + hours * 3600
    token = jwt.encode({"sub": str(user_id), "iat": now, "exp": exp}, _secret(), algorithm="HS256")
    return token, exp


def decode_token(token: str) -> str | None:
    """Return the user id (sub) if valid, else None."""
    try:
        data = jwt.decode(token, _secret(), algorithms=["HS256"])
        return data.get("sub")
    except Exception:
        return None
