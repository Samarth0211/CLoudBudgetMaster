# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**CloudPilot** — Multi-cloud cost monitoring + infra assistant SaaS. Connects to AWS, GCP, Azure, Snowflake via read-only APIs, detects unused/idle resources, sends cost spike alerts. See `ai_rules.md` for full architecture, schema, API design, and detection rules.

## Tech Stack

- **Backend:** Python 3.12, FastAPI, self-hosted PostgreSQL 16 + JWT auth, Resend (email), Razorpay (payments)
- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router, Axios, Recharts
- **AI:** Claude API (Anthropic) for RAG answers, OpenAI embeddings for doc search
- **Deploy:** Hostinger VPS (nginx + gunicorn/systemd), GitHub Actions (cron scans, doc crawler)

## Build & Run Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload        # Dev server at :8000

# Frontend
cd frontend
npm install
npm run dev                              # Dev server at :5173
npm run build                            # Production build
```

## Architecture

- Backend entry: `backend/main.py` — FastAPI app, CORS config, router registration
- Config: `backend/config.py` — pydantic-settings loading from `.env`
- DB: `backend/db/client.py` — psycopg2 query-builder over self-hosted PostgreSQL; queries scoped by `user_id`
- Auth: `backend/dependencies.py` — `get_current_user` dependency validates backend-issued HS256 JWT (`backend/core/security.py`)
- API routes: `backend/api/` — one file per feature (auth, connections, resources, alerts, dashboard, webhooks, assistant)
- Cloud scanners: `backend/services/{aws,gcp,azure,snowflake}/` — each has scanner.py (orchestrator), billing/cost module, unused.py (detection)
- Core: `backend/core/` — scanner_runner.py (dispatch), alert_engine.py, email_service.py, waste_calculator.py
- RAG: `backend/rag/` — crawler.py, chunker.py, embedder.py, retriever.py
- Frontend: `frontend/src/` — pages/, components/, hooks/, lib/ structure
- DB schema: `backend/db/schema_selfhosted.sql` — apply manually to your PostgreSQL database

## Key Rules (from ai_rules.md)

- All cloud API calls are **read-only** — never request write permissions
- Never store raw credentials — always Fernet-encrypt before DB insert
- Never log credentials — mask in all log statements
- Cost Explorer: call once/day/connection, cache in cost_snapshots, never from user-facing endpoints
- Claude API: use haiku for cost explanations (max_tokens=150), sonnet for RAG (max_tokens=800)
- RAG: zero hallucination policy — if answer not in context, say so explicitly
- Scope guard: see ai_rules.md "What NOT to Build" section before adding features

## Testing

```bash
cd backend
pytest tests/                            # Run all tests
pytest tests/test_aws_scanner.py -v      # Single test file
```
