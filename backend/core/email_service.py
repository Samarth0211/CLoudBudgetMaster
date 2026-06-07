import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import get_settings


def _send_email(to_email: str, subject: str, html: str, reply_to: str = "") -> bool:
    """Send an email via Hostinger SMTP."""
    settings = get_settings()

    if not settings.smtp_host or not settings.smtp_user:
        print("[Email] SMTP not configured, skipping")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"CloudBudgetMaster <{settings.smtp_from_email or settings.smtp_user}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[Email] Failed: {e}")
        return False


def _base_template(content: str) -> str:
    settings = get_settings()
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 0;">
      <div style="background: #0a0a0a; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">CloudBudgetMaster</span>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          {content}
        </div>

        <!-- Footer -->
        <div style="padding: 20px 32px; border-top: 1px solid #1e293b; background: #0a0a0a;">
          <p style="color: #475569; font-size: 11px; margin: 0; text-align: center;">
            CloudBudgetMaster &middot; Multi-cloud cost intelligence<br>
            <a href="{settings.frontend_url}" style="color: #FF9900; text-decoration: none;">cloudbudgetmaster.com</a>
          </p>
        </div>
      </div>
    </div>
    """


def send_password_reset_email(to_email: str, code: str) -> bool:
    """Send password reset code email."""
    content = f"""
    <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 8px 0;">Reset your password</h2>
    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px 0;">
      We received a request to reset your password. Use the code below to set a new one.
    </p>

    <div style="background: #111; border: 1px solid #1e293b; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Reset code</p>
      <p style="color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 0;">{code}</p>
    </div>

    <p style="color: #64748b; font-size: 12px; margin: 0;">
      This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
    </p>
    """
    return _send_email(to_email, f"CloudBudgetMaster — Password reset code: {code}", _base_template(content))


def send_verification_email(to_email: str, code: str, full_name: str) -> bool:
    """Send verification code email after signup."""
    content = f"""
    <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 8px 0;">Welcome, {full_name}</h2>
    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px 0;">
      Your account has been created. Use the code below to verify your email and complete sign-in.
    </p>

    <div style="background: #111; border: 1px solid #1e293b; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Verification code</p>
      <p style="color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 0;">{code}</p>
    </div>

    <p style="color: #64748b; font-size: 12px; margin: 0;">
      This code expires in 10 minutes. If you didn't create this account, ignore this email.
    </p>
    """
    return _send_email(to_email, f"Your CloudBudgetMaster verification code: {code}", _base_template(content))


def send_contact_notification(name: str, email: str, company: str, message: str) -> bool:
    """Notify the team of a new contact / demo request. Best-effort."""
    settings = get_settings()
    to = settings.contact_notify_email or settings.smtp_from_email or settings.smtp_user
    if not to:
        return False

    def esc(s):
        return (s or "—").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    body = esc(message).replace("\n", "<br>")
    content = f"""
    <h2 style="color:#ffffff;font-size:18px;margin:0 0 16px 0;">New contact / demo request</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="color:#64748b;font-size:12px;padding:4px 0;width:90px;">Name</td><td style="color:#e7ecf3;font-size:14px;">{esc(name)}</td></tr>
      <tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Email</td><td style="color:#e7ecf3;font-size:14px;">{esc(email)}</td></tr>
      <tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Company</td><td style="color:#e7ecf3;font-size:14px;">{esc(company)}</td></tr>
    </table>
    <div style="background:#111;border:1px solid #1e293b;border-radius:8px;padding:16px;color:#c5cedb;font-size:14px;line-height:1.6;">{body}</div>
    <p style="color:#475569;font-size:12px;margin-top:16px;">Reply directly to this email to respond to {esc(name)}.</p>
    """
    return _send_email(to, f"New demo request from {name}", _base_template(content), reply_to=email)


async def send_alert_email(to_email: str, alert_data: dict) -> bool:
    """Send a cost alert email."""
    settings = get_settings()
    rule_type = alert_data.get("rule_type", "cost_alert")
    threshold = alert_data.get("threshold", 0)
    current_value = alert_data.get("current_value", 0)
    message = alert_data.get("message", "A cost alert was triggered.")

    content = f"""
    <h2 style="color: #ef4444; font-size: 18px; margin: 0 0 12px 0;">{_friendly_rule_type(rule_type)}</h2>
    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 20px 0;">{message}</p>

    <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0;">
      <tr>
        <td style="background: #111; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Threshold</p>
          <p style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${threshold:.2f}</p>
        </td>
        <td style="background: #111; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">Current</p>
          <p style="color: #ef4444; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${current_value:.2f}</p>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin-top: 24px;">
      <a href="{settings.frontend_url}/alerts" style="display: inline-block; background: #FF9900; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 13px;">View in Dashboard</a>
    </div>
    """

    subject = f"CloudBudgetMaster Alert: {_friendly_rule_type(rule_type)}"
    return _send_email(to_email, subject, _base_template(content))


def send_new_post_notification(to_email: str, post: dict, post_url: str, unsubscribe_url: str) -> bool:
    """Notify a subscriber about a newly published blog post."""
    def esc(s):
        return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    title = esc(post.get("title"))
    excerpt = esc(post.get("meta_description") or post.get("excerpt") or "")
    category = esc(post.get("category") or "FinOps")
    content = f"""
    <p style="color:#FF9900;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 8px 0;">New on the blog &middot; {category}</p>
    <h2 style="color:#ffffff;font-size:20px;line-height:1.3;margin:0 0 12px 0;">{title}</h2>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px 0;">{excerpt}</p>
    <div style="margin-bottom:8px;">
      <a href="{post_url}" style="display:inline-block;background:#FF9900;color:#1a1205;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Read the full article →</a>
    </div>
    <p style="color:#64748b;font-size:12px;margin:24px 0 0 0;">
      You're receiving this because you have a CloudBudgetMaster account.
      <a href="{unsubscribe_url}" style="color:#64748b;text-decoration:underline;">Unsubscribe from blog emails</a>.
    </p>
    """
    return _send_email(to_email, f"{post.get('title')} — CloudBudgetMaster", _base_template(content))


def _friendly_rule_type(rule_type: str) -> str:
    return {
        "daily_cost_above": "Daily Cost Exceeded",
        "daily_spike_percent": "Cost Spike Detected",
        "new_unused_resource": "New Unused Resource Found",
    }.get(rule_type, "Cost Alert")
