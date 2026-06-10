"""Promo-code trials: a code grants a temporary paid plan, capped per email domain.

Built for the AWS cold-email campaign (Jun 2026): a recipient signs up with a code
and gets a 7-day Pro trial, then auto-downgrades to free (see dependencies.py, which
lazily expires the plan once plan_expires_at passes). One redemption per email domain
so a single company can't farm multiple trials.

Nothing here raises — the public register/check endpoints call it on untrusted input.
"""
from datetime import datetime, timedelta, timezone


def _domain(email: str) -> str:
    return (email or "").lower().rsplit("@", 1)[-1].strip()


def _as_aware(value):
    """Coerce a DB timestamp (datetime or ISO string) to a tz-aware UTC datetime."""
    if not value:
        return None
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(str(value))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def lookup_code(db, code: str):
    code_norm = (code or "").strip().upper()
    if not code_norm:
        return None
    res = db.table("promo_codes").select("*").eq("code", code_norm).execute()
    return (res.data or [None])[0]


def validate_promo(db, code: str, email: str):
    """Return (ok, info). info always has 'message'; on success also plan + trial_days."""
    code_norm = (code or "").strip().upper()
    if not code_norm:
        return False, {"message": "Enter a promo code."}

    promo = lookup_code(db, code_norm)
    if not promo or not promo.get("active", True):
        return False, {"message": "That promo code isn't valid."}

    valid_until = _as_aware(promo.get("valid_until"))
    if valid_until and datetime.now(timezone.utc) > valid_until:
        return False, {"message": "This offer has ended."}

    domain = _domain(email)
    if not domain:
        return False, {"message": "Enter your work email first."}

    max_per_domain = promo.get("max_per_domain") or 1
    used = db.table("promo_redemptions").select("id", count="exact") \
        .eq("code", code_norm).eq("email_domain", domain).execute()
    if (used.count or 0) >= max_per_domain:
        return False, {"message": "This code has already been used for your company."}

    plan = promo.get("plan", "pro")
    trial_days = promo.get("trial_days", 7)
    return True, {
        "message": f"{trial_days}-day {plan.capitalize()} trial — applies when you sign up.",
        "plan": plan,
        "trial_days": trial_days,
    }


def redeem_promo(db, code: str, email: str, profile_id: str):
    """Validate + record a redemption. Returns (plan, expires_at_iso) or (None, None).

    Records the redemption (UNIQUE(code, email_domain)) so the per-domain cap holds.
    Best-effort: on any problem the caller simply keeps the user on free.
    """
    ok, info = validate_promo(db, code, email)
    if not ok:
        return None, None

    expires = datetime.now(timezone.utc) + timedelta(days=info["trial_days"])
    try:
        db.table("promo_redemptions").insert({
            "code": (code or "").strip().upper(),
            "email_domain": _domain(email),
            "profile_id": profile_id,
        }).execute()
    except Exception:
        # Lost the race on UNIQUE(code, email_domain) — treat as already redeemed.
        return None, None
    return info["plan"], expires.isoformat()
