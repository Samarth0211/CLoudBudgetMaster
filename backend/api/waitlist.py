from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, constr

from backend.core.rate_limit import limiter
from backend.db.client import get_db

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistRequest(BaseModel):
    email: constr(strip_whitespace=True, min_length=3, max_length=254)
    product: constr(strip_whitespace=True, max_length=120) = ""
    source: constr(strip_whitespace=True, max_length=120) = ""


@router.post("")
@limiter.limit("10/minute")
async def join_waitlist(request: Request, body: WaitlistRequest):
    """Public, no-auth waitlist capture — landing "Notify me" and RI/SP waitlist
    prompts. Minimal validation, never 500s: any failure returns {ok: false}
    with 400 so the landing page can fail soft.
    """
    if "@" not in body.email:
        return JSONResponse(status_code=400, content={"ok": False})

    try:
        get_db().table("waitlist").insert({
            "email": body.email,
            "product": body.product or "",
            "source": body.source or "",
        }).execute()
    except Exception:
        return JSONResponse(status_code=400, content={"ok": False})

    return {"ok": True}
