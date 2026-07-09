import secrets

import httpx
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, EmailStr

from backend.config import get_settings
from backend.core.rate_limit import limiter
from backend.core import bill_audit_store
from backend.core.email_service import send_bill_audit_report_email
from backend.services.bill_audit.parser import parse_billing_csv
from backend.services.bill_audit.analyze import analyze_line_items
from backend.services.bill_audit.report import render_html_report

router = APIRouter(prefix="/bill-audit", tags=["bill-audit"])

# Hard cap for the public no-signup endpoint. Tighter than the parser's own
# 50MB safety valve (see parser.MAX_BYTES) since this is an unauthenticated,
# ungated upload — read only up to this many bytes off the wire and bail.
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# --- Paid, no-signup bill-audit products ------------------------------------
# One-time USD prices for the purchasable report products. RI/SP stays
# waitlist-only (see api/waitlist.py) — deliberately not sold here since we
# can't yet deliver that analysis honestly.
PRODUCTS = {
    "health-check": {"amount": "49.00", "currency": "USD", "label": "AWS Bill Health Check"},
    "ai-audit": {"amount": "79.00", "currency": "USD", "label": "AWS AI/ML Spend Audit"},
    "networking": {"amount": "39.00", "currency": "USD", "label": "AWS Hidden Networking Audit"},
    "msp": {"amount": "149.00", "currency": "USD", "label": "AWS Bill Audit — MSP Bundle"},
}


def _paypal_base_url() -> str:
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


class BillAuditOrderRequest(BaseModel):
    email: EmailStr
    product: str


class BillAuditOrderResponse(BaseModel):
    order_id: str
    approval_url: str


@router.post("/order", response_model=BillAuditOrderResponse)
@limiter.limit("10/minute")
async def create_bill_audit_order(request: Request, body: BillAuditOrderRequest):
    """Create a PayPal order for a one-time, no-signup bill-audit product.

    No auth — the purchase is tied to the buyer's email and a single-use
    report token generated here, not to a user account.
    """
    product = PRODUCTS.get(body.product)
    if not product:
        raise HTTPException(status_code=400, detail="Unknown product")

    settings = get_settings()
    token = await _get_paypal_token()

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {
                "currency_code": product["currency"],
                "value": product["amount"],
            },
            "description": product["label"],
        }],
        "application_context": {
            "return_url": f"{settings.frontend_url}/health-check?product={body.product}&paid=1",
            "cancel_url": f"{settings.frontend_url}/health-check?product={body.product}&cancelled=1",
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

    # Single-use report token, only ever handed out once capture succeeds.
    report_token = secrets.token_urlsafe(32)
    bill_audit_store.record_order(
        data["id"], str(body.email), body.product, product["amount"], product["currency"], report_token,
    )

    return BillAuditOrderResponse(order_id=data["id"], approval_url=approval_link)


class BillAuditCaptureRequest(BaseModel):
    order_id: str


@router.post("/capture")
@limiter.limit("10/minute")
async def capture_bill_audit_order(request: Request, body: BillAuditCaptureRequest):
    """Capture a PayPal order for a bill-audit product and unlock its report token."""
    order = bill_audit_store.get_order(body.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["status"] == "captured":
        # Idempotent — a page refresh / duplicate call shouldn't re-capture.
        return {"token": order["token"], "product": order["product"], "email": order["email"]}

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

    # Verify the captured amount + currency match what we recorded when the
    # order was created — never trust a completed order id on its own.
    pu = (data.get("purchase_units") or [{}])[0]
    cap = ((pu.get("payments") or {}).get("captures") or [{}])[0]
    amt = cap.get("amount", {})
    if amt.get("value") != order["amount"] or amt.get("currency_code") != order["currency"]:
        raise HTTPException(status_code=400, detail="Payment amount mismatch")

    bill_audit_store.mark_captured(body.order_id)

    return {"token": order["token"], "product": order["product"], "email": order["email"]}


@router.post("/paid-report")
@limiter.limit("20/minute")
async def paid_bill_audit_report(request: Request, token: str = Form(...), file: UploadFile = File(...)):
    """Redeem a single-use, paid report token to run the full bill-audit
    engine, email the HTML report to the buyer's email on file, and return
    the findings inline for the frontend to render.

    Never persists the uploaded CSV; never 500s on bad input.
    """
    try:
        order = bill_audit_store.get_order_by_token(token)
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid, unpaid, or already-used report token")
    if not order or order["status"] != "captured" or order["used"]:
        raise HTTPException(status_code=403, detail="Invalid, unpaid, or already-used report token")

    # Atomically claim the token (used 0 -> 1 in one UPDATE) before doing any
    # of the slow work below. This closes the check-then-act race where two
    # concurrent requests with the same token could both pass the check above
    # and both generate + email a report. If we lose the claim, someone else
    # already has it in flight (or finished) — reject, don't regenerate.
    try:
        claimed = bill_audit_store.claim_token(token)
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid, unpaid, or already-used report token")
    if not claimed:
        raise HTTPException(status_code=403, detail="Invalid, unpaid, or already-used report token")

    product = PRODUCTS.get(order["product"], {"label": "AWS Bill Audit"})

    try:
        chunks = []
        total = 0
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > _MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"File is too large. Max supported size is "
                        f"{_MAX_UPLOAD_BYTES // (1024 * 1024)} MB. "
                        "Export a grouped summary (by Service/Usage Type) instead of a raw CUR dump."
                    ),
                )
            chunks.append(chunk)
        raw_bytes = b"".join(chunks)
    except HTTPException:
        _release_token_safely(token)
        raise
    except Exception:
        _release_token_safely(token)
        raise HTTPException(status_code=400, detail="Could not read the uploaded file.")
    finally:
        try:
            await file.close()
        except Exception:
            pass

    try:
        parse_result = parse_billing_csv(raw_bytes, filename=file.filename)
    except Exception:
        _release_token_safely(token)
        raise HTTPException(status_code=400, detail="Could not parse the uploaded CSV.")

    if not parse_result.ok:
        _release_token_safely(token)
        raise HTTPException(status_code=400, detail=parse_result.error or "Could not parse the uploaded CSV.")

    try:
        report = analyze_line_items(parse_result.line_items, warnings=parse_result.warnings)
    except Exception:
        _release_token_safely(token)
        raise HTTPException(status_code=400, detail="Could not analyze the uploaded CSV.")

    # From here on the report was generated successfully — the token stays
    # claimed/used even if the email send itself fails below.
    try:
        report_html = render_html_report(report, source_filename=file.filename)
        send_bill_audit_report_email(order["email"], product["label"], report_html)
    except Exception:
        # Best-effort email — the buyer still gets the inline report below.
        pass

    return {"ok": True, "report": report.to_dict()}


def _release_token_safely(token: str) -> None:
    """Undo an in-flight claim after a buyer-retriable failure (bad upload,
    unparseable CSV) so the paid token isn't burned by their own mistake.
    Logs (doesn't raise) on a DB write failure so ops can see it.
    """
    try:
        bill_audit_store.release_token(token)
    except Exception as e:  # noqa: BLE001
        print(f"[bill_audit] release_token failed for token state write: {e}")


@router.post("/check")
@limiter.limit("20/minute")
async def check_bill(request: Request, file: UploadFile = File(...)):
    """Public, no-signup bill health check. Accepts a CSV upload, runs the
    bill-audit engine in memory, and returns the findings report. Nothing is
    persisted — the file bytes are discarded when the request completes.
    """
    try:
        chunks = []
        total = 0
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > _MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"File is too large. Max supported size is "
                        f"{_MAX_UPLOAD_BYTES // (1024 * 1024)} MB. "
                        "Export a grouped summary (by Service/Usage Type) instead of a raw CUR dump."
                    ),
                )
            chunks.append(chunk)
        raw_bytes = b"".join(chunks)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the uploaded file.")
    finally:
        try:
            await file.close()
        except Exception:
            pass

    try:
        parse_result = parse_billing_csv(raw_bytes, filename=file.filename)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse the uploaded CSV.")

    if not parse_result.ok:
        raise HTTPException(status_code=400, detail=parse_result.error or "Could not parse the uploaded CSV.")

    try:
        report = analyze_line_items(parse_result.line_items, warnings=parse_result.warnings)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not analyze the uploaded CSV.")

    return report.to_dict()
