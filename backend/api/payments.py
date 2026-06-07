import httpx
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from backend.config import get_settings
from backend.dependencies import get_current_user
from backend.db.client import get_db
from backend.core.rate_limit import limiter
from backend.core.payment_store import record_order, get_order, mark_captured

router = APIRouter(prefix="/payments", tags=["payments"])

PLAN_PRICES = {
    "pro": {"amount": "29.00", "currency": "USD", "label": "CloudBudgetMaster Pro — Monthly"},
}

PROMO_CODES = {
    "PRODUCTHUNT": {"plan": "pro", "duration_days": 30, "expires": date(2026, 12, 31)},
    "SAASHIVE": {"plan": "pro", "duration_days": 30, "expires": date(2026, 12, 31)},
}


def _paypal_base_url():
    settings = get_settings()
    if settings.paypal_mode == "live":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


async def _get_paypal_token() -> str:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paypal_base_url()}/v1/oauth2/token",
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            data={"grant_type": "client_credentials"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to authenticate with PayPal")
        return resp.json()["access_token"]


class CreateOrderResponse(BaseModel):
    order_id: str
    approval_url: str


@router.post("/create-order", response_model=CreateOrderResponse)
@limiter.limit("10/minute")
async def create_order(request: Request, user=Depends(get_current_user)):
    """Create a PayPal order for Pro plan upgrade."""
    if user.get("plan") == "pro":
        raise HTTPException(status_code=400, detail="You are already on the Pro plan")

    settings = get_settings()
    plan = PLAN_PRICES["pro"]
    token = await _get_paypal_token()

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {
                "currency_code": plan["currency"],
                "value": plan["amount"],
            },
            "description": plan["label"],
            "custom_id": user["id"],
        }],
        "application_context": {
            "return_url": f"{settings.frontend_url}/dashboard?payment=success",
            "cancel_url": f"{settings.frontend_url}/dashboard?payment=cancelled",
            "brand_name": "CloudBudgetMaster",
            "user_action": "PAY_NOW",
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders",
            json=order_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Failed to create PayPal order")

    data = resp.json()
    approval_link = next((l["href"] for l in data.get("links", []) if l["rel"] == "approve"), None)
    if not approval_link:
        raise HTTPException(status_code=502, detail="No approval URL returned from PayPal")

    # Remember which user this order is for + the expected amount, so capture can
    # verify it instead of trusting any completed order id.
    record_order(data["id"], user["id"], "pro", plan["amount"], plan["currency"])

    return CreateOrderResponse(order_id=data["id"], approval_url=approval_link)


class CaptureRequest(BaseModel):
    order_id: str


@router.post("/capture-order")
@limiter.limit("10/minute")
async def capture_order(request: Request, body: CaptureRequest, user=Depends(get_current_user)):
    """Capture a PayPal order, verifying it belongs to this user, then upgrade."""
    # 1. The order must be one WE created for THIS user.
    order = get_order(body.order_id)
    if not order or order["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] == "captured":
        # Idempotent — already processed (e.g. a page refresh). Don't double-capture.
        return {"status": "success", "plan": order["plan"], "paypal_order_id": body.order_id, "already_processed": True}

    token = await _get_paypal_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders/{body.order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail="Payment capture failed")

    data = resp.json()
    if data.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {data.get('status')}")

    # 2. Verify the captured custom_id, amount, and currency match what we recorded.
    pu = (data.get("purchase_units") or [{}])[0]
    if pu.get("custom_id") and pu.get("custom_id") != user["id"]:
        raise HTTPException(status_code=403, detail="This order does not belong to you")
    cap = ((pu.get("payments") or {}).get("captures") or [{}])[0]
    amt = cap.get("amount", {})
    if amt.get("value") != order["amount"] or amt.get("currency_code") != order["currency"]:
        raise HTTPException(status_code=400, detail="Payment amount mismatch")

    # 3. All good — mark captured (prevents replay) and upgrade.
    mark_captured(body.order_id)
    db = get_db()
    db.table("profiles").update({"plan": "pro"}).eq("id", user["id"]).execute()

    return {"status": "success", "plan": "pro", "paypal_order_id": data["id"]}


class PromoCodeRequest(BaseModel):
    code: str


@router.post("/redeem-promo")
@limiter.limit("5/minute")
async def redeem_promo(request: Request, body: PromoCodeRequest, user=Depends(get_current_user)):
    """Redeem a promo code for free Pro access."""
    if user.get("plan") == "pro":
        raise HTTPException(status_code=400, detail="You are already on the Pro plan")

    code = body.code.strip().upper()
    promo = PROMO_CODES.get(code)

    if not promo:
        raise HTTPException(status_code=400, detail="Invalid promo code")

    if date.today() > promo["expires"]:
        raise HTTPException(status_code=400, detail="This promo code has expired")

    # Upgrade user
    db = get_db()
    db.table("profiles").update({
        "plan": promo["plan"],
        "promo_code": code,
    }).eq("id", user["id"]).execute()

    return {
        "status": "success",
        "plan": promo["plan"],
        "message": f"Pro plan activated for {promo['duration_days']} days!",
    }


@router.get("/status")
async def payment_status(user=Depends(get_current_user)):
    """Return current plan info."""
    return {
        "plan": user.get("plan", "free"),
        "user_id": user["id"],
    }
