import httpx
import json
from backend.config import get_settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def _build_system_prompt(context: dict) -> str:
    """Build system prompt with user's cloud context."""
    total_cost = context.get("total_monthly_cost_usd", 0)
    waste_cost = context.get("total_waste_cost_usd", 0)
    resource_count = context.get("total_resources", 0)
    unused_count = context.get("unused_resources", 0)
    top_wasters = context.get("top_wasters", [])

    wasters_text = ""
    if top_wasters:
        lines = []
        for w in top_wasters[:5]:
            lines.append(f"  - {w.get('resource_name', 'Unknown')} ({w.get('resource_type', '')}): "
                        f"${w.get('waste_monthly_cost_usd', 0):.2f}/mo wasted - {w.get('waste_reason', '')}")
        wasters_text = "\n".join(lines)

    return f"""You are CloudPilot AI, a friendly cloud cost optimization assistant. You help users understand and reduce their cloud spending.

USER'S CLOUD SUMMARY:
- Total monthly cost: ${total_cost:.2f}
- Wasted spend: ${waste_cost:.2f}/mo
- Total resources: {resource_count}
- Unused/idle resources: {unused_count}

TOP WASTERS:
{wasters_text or "  No waste detected yet"}

GUIDELINES:
- Be concise and friendly. Use plain language, avoid jargon.
- When discussing costs, always mention specific dollar amounts.
- Suggest actionable steps the user can take right now.
- If you don't know something specific about their infrastructure, say so.
- Reference their actual data when possible.
- Keep responses under 200 words unless the user asks for detail.
- Use bullet points for lists of actions."""


async def chat_with_ai(message: str, history: list, context: dict) -> dict:
    """Send a chat message to Groq and return the AI response."""
    settings = get_settings()
    api_key = settings.groq_api_key

    if not api_key:
        return {
            "reply": "AI assistant is not configured. Please add a Groq API key to enable chat.",
            "suggestions": [],
        }

    system_prompt = _build_system_prompt(context)

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 messages)
    for msg in history[-10:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "temperature": 0.4,
                    "max_tokens": 600,
                },
            )
            response.raise_for_status()

        data = response.json()
        reply = data["choices"][0]["message"]["content"]

        # Generate follow-up suggestions
        suggestions = _generate_suggestions(message, reply)

        return {
            "reply": reply,
            "suggestions": suggestions,
        }

    except Exception as e:
        print(f"[AI Chat] Groq chat failed: {e}")
        return {
            "reply": "I'm having trouble connecting right now. Please try again in a moment.",
            "suggestions": ["What am I wasting?", "Show my costs"],
        }


def _generate_suggestions(user_msg: str, ai_reply: str) -> list:
    """Generate contextual follow-up suggestions based on the conversation."""
    lower = (user_msg + " " + ai_reply).lower()

    if "cost" in lower or "spend" in lower:
        return ["How can I reduce costs?", "Show top wasters", "Forecast next month"]
    if "wast" in lower or "unused" in lower:
        return ["How do I fix this?", "Show savings report", "What else is wasted?"]
    if "ec2" in lower or "instance" in lower:
        return ["Should I downsize?", "Show idle instances", "What size should I use?"]
    if "save" in lower or "optimi" in lower:
        return ["Show me quick wins", "What's the biggest waste?", "Compare resources"]

    return ["What am I wasting?", "Show my costs", "How can I save money?"]
