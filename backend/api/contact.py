from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, constr
from backend.db.client import get_supabase

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1, max_length=120)
    email: EmailStr
    company: constr(strip_whitespace=True, max_length=160) = ""
    message: constr(strip_whitespace=True, min_length=5, max_length=4000)


@router.post("", status_code=201)
async def submit_contact(body: ContactRequest):
    """Public endpoint — store a contact/demo request. No auth required."""
    supabase = get_supabase()
    try:
        supabase.table("contact_messages").insert({
            "name": body.name,
            "email": str(body.email),
            "company": body.company or None,
            "message": body.message,
        }).execute()
    except Exception:
        # Don't leak internals; the row may fail only if the table is missing.
        raise HTTPException(status_code=500, detail="Could not submit your message right now. Please email us directly.")

    # Best-effort email notification — never fail the request if email is down.
    try:
        from backend.core.email_service import send_contact_notification
        send_contact_notification(body.name, str(body.email), body.company, body.message)
    except Exception:
        pass

    return {"status": "received"}
