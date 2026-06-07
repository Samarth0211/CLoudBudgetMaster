"""Public (no-login) FinOps assistant for the landing page.

Answers general cloud-cost questions with an open-source model (GPT-OSS-120B on
Groq). It has NO access to any visitor account/data and must not pretend to.
Kept tight + on-topic; the API layer rate-limits it per IP.
"""
import httpx

from backend.config import get_settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
FALLBACK_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are the CloudBudgetMaster assistant — a friendly, knowledgeable cloud cost expert on a public website. The visitor is NOT logged in, so you have no access to their account or data; never pretend to.

You help with cloud cost optimization & FinOps across AWS, GCP and Azure: finding idle/unused resources, rightsizing, Reserved Instances vs Savings Plans vs Spot, storage/egress costs, tagging & cost allocation, budgets and spike alerts, and general "why is my cloud bill high / how do I cut it" questions.

GUIDELINES:
- Be concise (under ~140 words), accurate and practical. Use specific service names, settings or CLI when it helps.
- NEVER invent statistics, prices, or customer names.
- If asked something unrelated to cloud, infrastructure or cost, briefly say it's outside what you help with and steer back.
- Never ask for or accept credentials, access keys, or secrets.
- When it's genuinely relevant, you can mention once that CloudBudgetMaster scans an AWS/GCP account read-only and finds waste automatically with exact dollar figures — but don't be pushy or repeat it every message.
- Use plain language and short paragraphs or bullets."""

GREETING = "Hi! I'm the CloudBudgetMaster assistant. Ask me anything about cutting your AWS, GCP, or Azure bill — idle resources, rightsizing, Reserved Instances, tagging, and more."


async def public_assistant(message: str, history: list) -> dict:
    settings = get_settings()
    if not settings.groq_api_key:
        return {"reply": "The assistant isn't available right now. Please try again later.", "suggestions": []}

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in (history or [])[-8:]:
        role = m.get("role") if isinstance(m, dict) else getattr(m, "role", "user")
        content = m.get("content") if isinstance(m, dict) else getattr(m, "content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)[:1500]})
    messages.append({"role": "user", "content": message[:1000]})

    model = settings.groq_report_model or FALLBACK_MODEL
    for attempt in (model, FALLBACK_MODEL):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    GROQ_API_URL,
                    headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
                    json={"model": attempt, "messages": messages, "temperature": 0.4, "max_tokens": 400},
                )
                resp.raise_for_status()
            reply = resp.json()["choices"][0]["message"]["content"].strip()
            return {"reply": reply, "suggestions": _suggest(message + " " + reply)}
        except Exception as e:  # noqa: BLE001
            print(f"[public_chat] model {attempt} failed: {e}")
            if attempt == FALLBACK_MODEL:
                break
    return {"reply": "I'm having trouble right now — please try again in a moment.", "suggestions": []}


def _suggest(text: str) -> list:
    t = (text or "").lower()
    if "reserved" in t or "savings plan" in t or "spot" in t:
        return ["When should I use Spot?", "How much do RIs save?", "Savings Plans vs RIs?"]
    if "idle" in t or "unused" in t or "waste" in t:
        return ["How do I find idle EC2?", "What about unattached volumes?", "Can you scan my account?"]
    if "s3" in t or "storage" in t:
        return ["S3 storage classes?", "Cut data egress costs?", "Lifecycle policies?"]
    return ["How do I cut my AWS bill?", "What is an idle resource?", "Reserved Instances vs Savings Plans?"]
