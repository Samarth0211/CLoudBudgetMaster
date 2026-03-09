import httpx
from backend.config import get_settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_alert_email(to_email: str, alert_data: dict) -> bool:
    """Send a cost alert email via Resend API."""
    settings = get_settings()
    api_key = settings.resend_api_key

    if not api_key:
        print("[Email] Resend API key not configured, skipping email")
        return False

    rule_type = alert_data.get("rule_type", "cost_alert")
    threshold = alert_data.get("threshold", 0)
    current_value = alert_data.get("current_value", 0)
    message = alert_data.get("message", "A cost alert was triggered.")

    subject = f"CloudPilot Alert: {_friendly_rule_type(rule_type)}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F1A; color: #e2e8f0; padding: 32px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 12px; border-radius: 12px;">
          <span style="font-size: 24px; color: white; font-weight: bold;">CloudPilot</span>
        </div>
      </div>

      <div style="background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
        <h2 style="color: #f87171; margin: 0 0 12px 0; font-size: 18px;">Alert Triggered</h2>
        <p style="color: #94a3b8; margin: 0 0 16px 0; font-size: 14px;">{message}</p>

        <div style="display: flex; gap: 16px;">
          <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">Threshold</p>
            <p style="color: white; font-size: 20px; font-weight: bold; margin: 4px 0 0 0;">${threshold:.2f}</p>
          </div>
          <div style="flex: 1; background: rgba(239,68,68,0.1); border-radius: 8px; padding: 12px;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">Current Value</p>
            <p style="color: #f87171; font-size: 20px; font-weight: bold; margin: 4px 0 0 0;">${current_value:.2f}</p>
          </div>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="{settings.frontend_url}/alerts" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Dashboard</a>
      </div>

      <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">You received this because you have email alerts enabled on CloudPilot.</p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "CloudPilot <alerts@cloudpilot.dev>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                },
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"[Email] Failed to send alert email: {e}")
        return False


def _friendly_rule_type(rule_type: str) -> str:
    return {
        "daily_cost_above": "Daily Cost Exceeded",
        "daily_spike_percent": "Cost Spike Detected",
        "new_unused_resource": "New Unused Resource Found",
    }.get(rule_type, "Cost Alert")
