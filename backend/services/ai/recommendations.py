import httpx
import json
from backend.config import get_settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(resource: dict) -> str:
    """Build a focused prompt from resource data."""
    meta = resource.get("metadata") or {}
    r_type = resource.get("resource_type", "unknown")
    waste_reason = resource.get("waste_reason", "")
    cost = resource.get("monthly_cost_usd", 0)
    waste_cost = resource.get("waste_monthly_cost_usd", 0)

    # Build context lines from available metadata
    context_lines = [
        f"Resource Type: {r_type}",
        f"Resource Name: {resource.get('resource_name', 'N/A')}",
        f"Region: {resource.get('region', 'N/A')}",
        f"Status: {resource.get('status', 'N/A')}",
        f"Monthly Cost: ${cost:.2f}",
        f"Wasted Cost: ${waste_cost:.2f}/mo",
        f"Waste Reason: {waste_reason}",
    ]

    if meta.get("instance_type"):
        context_lines.append(f"Instance Type: {meta['instance_type']}")
    if meta.get("avg_cpu_14d") is not None:
        context_lines.append(f"Average CPU (14 days): {meta['avg_cpu_14d']}%")
    if meta.get("db_class"):
        context_lines.append(f"DB Class: {meta['db_class']}")
    if meta.get("engine"):
        context_lines.append(f"Engine: {meta['engine']}")
    if meta.get("storage_gb"):
        context_lines.append(f"Storage: {meta['storage_gb']} GB")
    if meta.get("total_connections_7d") is not None:
        context_lines.append(f"Total DB Connections (7 days): {meta['total_connections_7d']}")
    if meta.get("volume_type"):
        context_lines.append(f"Volume Type: {meta['volume_type']}")
    if meta.get("size_gb"):
        context_lines.append(f"Volume Size: {meta['size_gb']} GB")
    if meta.get("platform"):
        context_lines.append(f"Platform: {meta['platform']}")
    if meta.get("created_by"):
        context_lines.append(f"Created By: {meta['created_by']}")

    context = "\n".join(context_lines)

    return f"""You are an AWS cloud cost optimization expert. Analyze this resource and give specific, actionable recommendations.

RESOURCE DATA:
{context}

Give your response as JSON with this exact format:
{{
  "summary": "One sentence summary of what to do",
  "steps": [
    "Step 1: specific action with exact AWS values/sizes to use",
    "Step 2: ...",
    "Step 3: ...",
    "Step 4: ...",
    "Step 5: ..."
  ]
}}

Rules:
- Be SPECIFIC: mention exact instance types to downsize to, exact cost savings, exact AWS console paths
- If CPU is low, recommend a specific smaller instance type and its monthly cost
- If a resource is stopped/unattached, recommend cleanup steps with backup advice
- If it's an EKS/auto-scaling managed resource, note that changes should be made at the node group level
- Include estimated monthly savings in the summary
- Keep each step to 1-2 sentences max
- Return ONLY valid JSON, no markdown or extra text"""


async def generate_recommendation(resource: dict) -> dict | None:
    """Generate AI recommendation for a wasteful resource. Returns None if unavailable."""
    settings = get_settings()
    api_key = settings.groq_api_key

    if not api_key:
        return None

    prompt = _build_prompt(resource)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 500,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        recommendation = json.loads(content)

        # Validate structure
        if "summary" not in recommendation or "steps" not in recommendation:
            return None

        # Ensure steps is a list of strings, strip "Step N:" prefixes
        import re
        recommendation["steps"] = [
            re.sub(r'^Step\s*\d+\s*:\s*', '', str(s)) for s in recommendation["steps"][:6]
        ]

        return {
            "summary": recommendation["summary"],
            "steps": recommendation["steps"],
            "ai_generated": True,
        }

    except Exception as e:
        print(f"[AI] Groq recommendation failed: {e}")
        return None
