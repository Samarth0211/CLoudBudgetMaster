import sys, io, os

# Fix Windows cp1252 encoding issues (Python 3.14 tracebacks use Unicode arrows)
if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ["PYTHONUTF8"] = "1"

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.config import get_settings
from backend.api import auth, connections, dashboard, resources, alerts, assistant, payments, contact
from backend.core.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

settings = get_settings()

app = FastAPI(
    title="CloudBudgetMaster API",
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
)

# Rate limiting (slowapi) — protects public auth/contact endpoints from abuse.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
_origins = [
    settings.frontend_url,
    "http://localhost:5173",
]
# Allow any *.vercel.app origin in production
if settings.environment == "production":
    _origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/v1")
app.include_router(connections.router, prefix="/v1")
app.include_router(dashboard.router, prefix="/v1")
app.include_router(resources.router, prefix="/v1")
app.include_router(alerts.router, prefix="/v1")
app.include_router(assistant.router, prefix="/v1")
app.include_router(payments.router, prefix="/v1")
app.include_router(contact.router, prefix="/v1")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)[:500]})


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
