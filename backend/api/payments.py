import httpx
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.config import get_settings
from backend.dependencies import get_current_user
from backend.db.client import get_supabase

router = APIRouter(prefix="/payments", tags=["payments"])

PLAN_PRICES = {
    "pro": {"amount": "29.00", "currency": "USD", "label": "CloudBudgetMaster Pro — Monthly"},
}

PROMO_CODES = {
    "PRODUCTHUNT": {"plan": "pro", "duration_days": 30, "expires": date(2026, 4, 24)},
    "SAASHIVE": {"plan": "pro", "duration_days": 30, "expires": date(2026, 4, 30)},
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
async def create_order(user=Depends(get_current_user)):
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

    return CreateOrderResponse(order_id=data["id"], approval_url=approval_link)


class CaptureRequest(BaseModel):
    order_id: str


@router.post("/capture-order")
async def capture_order(body: CaptureRequest, user=Depends(get_current_user)):
    """Capture a PayPal order after user approval and upgrade to Pro."""
    token = await _get_paypal_token()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders/{body.order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail="Payment capture failed")

    data = resp.json()
    if data.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {data.get('status')}")

    # Upgrade user to Pro
    supabase = get_supabase()
    supabase.table("profiles").update({"plan": "pro"}).eq("id", user["id"]).execute()

    return {
        "status": "success",
        "plan": "pro",
        "paypal_order_id": data["id"],
    }


class PromoCodeRequest(BaseModel):
    code: str


@router.post("/redeem-promo")
async def redeem_promo(body: PromoCodeRequest, user=Depends(get_current_user)):
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
    supabase = get_supabase()
    supabase.table("profiles").update({
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
