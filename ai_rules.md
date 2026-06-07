# CloudPilot — AI Rules & Project Intelligence
> This file tells any AI assistant (Cursor, Claude, Copilot, etc.) everything it needs to know
> about this project. Always include this file in your context window before asking for help.

---

## 🧠 What This Project Is

**CloudPilot** is a multi-cloud cost monitoring + infrastructure assistant SaaS tool.
It connects to AWS, GCP, Azure, and Snowflake via read-only APIs, detects wasted/unused
resources, sends cost spike alerts, and (in Phase 2) answers infrastructure questions
grounded strictly in official documentation — no hallucination.

**The core value proposition:**
> "Your AWS bill went from $2,000 to $6,000 last month because of 3 forgotten EKS clusters
> and idle dev environments. CloudPilot would have caught this in week one."

---

## 👤 Developer Context

- Solo developer, weekends only (2-3 hrs/week)
- Stack: Python, FastAPI, React, self-hosted PostgreSQL, LangChain, Claude API
- Cloud experience: AWS (primary), GCP/Vertex AI, Snowflake/Redshift
- Budget constraint: Total infra must stay on free tiers where possible
- Payments: Razorpay (India)
- Deployment: Hostinger VPS (nginx + gunicorn/systemd)

---

## 📁 Project Structure

```
cloudpilot/
├── backend/                        # FastAPI application
│   ├── main.py                     # App entry point, router registration
│   ├── config.py                   # Settings via pydantic-settings (.env)
│   ├── dependencies.py             # Shared FastAPI dependencies (auth, db)
│   ├── api/
│   │   ├── auth.py                 # Login, register, JWT endpoints
│   │   ├── connections.py          # Cloud account connect/disconnect
│   │   ├── resources.py            # List all cloud resources + costs
│   │   ├── alerts.py               # Alert rules CRUD + trigger history
│   │   ├── dashboard.py            # Aggregated cost + waste summary
│   │   ├── assistant.py            # Phase 2: RAG Q&A endpoint
│   │   └── webhooks.py             # Razorpay payment webhooks
│   ├── services/
│   │   ├── aws/
│   │   │   ├── scanner.py          # Scans all AWS resources
│   │   │   ├── cost_explorer.py    # Pulls billing data via Cost Explorer API
│   │   │   └── unused.py           # Unused resource detection logic
│   │   ├── gcp/
│   │   │   ├── scanner.py
│   │   │   ├── billing.py
│   │   │   └── unused.py
│   │   ├── azure/
│   │   │   ├── scanner.py
│   │   │   ├── billing.py
│   │   │   └── unused.py
│   │   └── snowflake/
│   │       ├── scanner.py
│   │       └── unused.py
│   ├── core/
│   │   ├── scanner_runner.py       # Orchestrates all cloud scans (called by cron)
│   │   ├── alert_engine.py         # Evaluates alert rules, triggers notifications
│   │   ├── email_service.py        # Resend.com integration
│   │   └── waste_calculator.py     # Normalizes waste across clouds into $
│   ├── rag/                        # Phase 2 only
│   │   ├── crawler.py              # Crawls official docs weekly
│   │   ├── chunker.py              # Splits docs into retrieval chunks
│   │   ├── embedder.py             # Generates + stores embeddings
│   │   └── retriever.py            # Query → retrieve → answer with citation
│   ├── models/
│   │   ├── user.py                 # Pydantic models for user
│   │   ├── connection.py           # Cloud connection models
│   │   ├── resource.py             # Cloud resource models
│   │   └── alert.py                # Alert rule + event models
│   ├── db/
│   │   ├── client.py               # psycopg2 query-builder (PostgreSQL)
│   │   └── schema_selfhosted.sql   # Schema applied to PostgreSQL
│   ├── tests/
│   │   ├── test_aws_scanner.py
│   │   ├── test_unused_detection.py
│   │   └── test_alert_engine.py
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                       # React + Tailwind application
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx         # Public marketing page
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx       # Main cost overview
│   │   │   ├── Resources.jsx       # All resources table with waste flags
│   │   │   ├── Alerts.jsx          # Alert rules management
│   │   │   ├── Connections.jsx     # Connect/manage cloud accounts
│   │   │   ├── Assistant.jsx       # Phase 2: Chat interface
│   │   │   └── Settings.jsx        # Account, billing, team
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Navbar.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── CostSummaryCard.jsx
│   │   │   │   ├── WasteByCloudChart.jsx
│   │   │   │   ├── SpikeBanner.jsx
│   │   │   │   └── TopWastersTable.jsx
│   │   │   ├── resources/
│   │   │   │   ├── ResourceTable.jsx
│   │   │   │   └── WasteBadge.jsx
│   │   │   └── shared/
│   │   │       ├── CloudBadge.jsx
│   │   │       ├── LoadingSpinner.jsx
│   │   │       └── EmptyState.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useResources.js
│   │   │   └── useAlerts.js
│   │   ├── lib/
│   │   │   └── api.js              # Axios instance + interceptors
│   │   └── styles/
│   │       └── index.css
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── .github/
│   └── workflows/
│       ├── scan_cron.yml           # Daily cloud scan (GitHub Actions free)
│       └── doc_crawler.yml         # Weekly doc crawl for Phase 2 RAG
│
├── ai_rules.md                     # THIS FILE — always include in AI context
└── README.md
```

---

## 🗄️ Database Schema

All tables live in the self-hosted PostgreSQL database. Use UUIDs for all primary keys.

```sql
-- Users (auth owned by the backend: bcrypt password_hash + email_verified)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'team')),
  razorpay_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cloud account connections
CREATE TABLE cloud_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'gcp', 'azure', 'snowflake')),
  display_name TEXT,                        -- e.g. "Production AWS"
  credentials_encrypted TEXT NOT NULL,      -- AES encrypted JSON blob
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'paused')),
  last_scanned_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All discovered cloud resources
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,              -- 'ec2_instance', 'eks_cluster', etc.
  resource_id TEXT NOT NULL,               -- Cloud-native ID
  resource_name TEXT,
  region TEXT,
  status TEXT,                              -- 'running', 'stopped', 'idle', etc.
  monthly_cost_usd NUMERIC(10, 4),
  waste_status TEXT CHECK (
    waste_status IN ('active', 'unused', 'idle', 'oversized', 'orphaned')
  ),
  waste_reason TEXT,                        -- Human-readable: "No traffic in 30 days"
  waste_monthly_cost_usd NUMERIC(10, 4),
  metadata JSONB,                           -- Raw API response for reference
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, resource_id)
);

-- Daily cost snapshots per connection
CREATE TABLE cost_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_cost_usd NUMERIC(10, 4),
  waste_cost_usd NUMERIC(10, 4),
  resource_count INT,
  unused_resource_count INT,
  raw_breakdown JSONB,                      -- Cost by service
  UNIQUE(connection_id, snapshot_date)
);

-- Alert rules defined by users
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (
    rule_type IN ('cost_spike', 'unused_resource', 'budget_threshold', 'new_resource')
  ),
  threshold_value NUMERIC(10, 4),           -- e.g. 20 for 20% spike
  threshold_unit TEXT,                      -- 'percent', 'usd'
  notify_email BOOLEAN DEFAULT TRUE,
  notify_slack BOOLEAN DEFAULT FALSE,
  slack_webhook_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert events (when an alert fired)
CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT NOT NULL,
  details JSONB,                            -- Specific resources/costs that triggered it
  acknowledged BOOLEAN DEFAULT FALSE
);

-- Phase 2: RAG document chunks
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,                   -- 'aws', 'gcp', 'azure', 'snowflake'
  service TEXT NOT NULL,                    -- 'eks', 'iam', 'bigquery', etc.
  doc_url TEXT NOT NULL,
  doc_title TEXT,
  chunk_text TEXT NOT NULL,
  chunk_index INT,
  embedding vector(1536),                   -- OpenAI/Cohere embedding dimensions
  last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doc_url, chunk_index)
);

CREATE INDEX ON doc_chunks USING ivfflat (embedding vector_cosine_ops);
```

---

## 🔌 API Endpoints

Base URL: `https://api.cloudpilot.app/v1`
Auth: Bearer JWT (backend-issued HS256 JWT) on all protected routes.

```
AUTH
POST   /auth/register              Create account
POST   /auth/login                 Returns JWT
POST   /auth/logout

CONNECTIONS
GET    /connections                 List all cloud connections
POST   /connections                 Add new cloud connection
DELETE /connections/{id}            Remove connection
POST   /connections/{id}/scan       Trigger manual scan
GET    /connections/{id}/status     Last scan status + error

DASHBOARD
GET    /dashboard/summary           Total cost, total waste, % change WoW
GET    /dashboard/trend             Daily cost for last 30 days (chart data)
GET    /dashboard/top-waste         Top 10 most wasteful resources

RESOURCES
GET    /resources                   All resources (filter: provider, waste_status)
GET    /resources/{id}              Single resource detail
GET    /resources/unused            Only unused/idle resources

ALERTS
GET    /alerts/rules                List alert rules
POST   /alerts/rules                Create alert rule
PUT    /alerts/rules/{id}           Update alert rule
DELETE /alerts/rules/{id}           Delete alert rule
GET    /alerts/events               Alert event history
POST   /alerts/events/{id}/ack      Acknowledge an alert

BILLING
POST   /billing/checkout            Create Razorpay order
POST   /billing/webhook             Razorpay webhook (public, verified by signature)
GET    /billing/subscription        Current plan + renewal date

ASSISTANT (Phase 2)
POST   /assistant/ask               { question, context_paste } → { answer, citations }
```

---

## ☁️ Cloud Integration Rules

### AWS
- **SDK:** `boto3`
- **Required IAM permissions (read-only):**
  ```
  ce:GetCostAndUsage
  ec2:DescribeInstances
  ec2:DescribeVolumes
  eks:ListClusters
  eks:DescribeCluster
  rds:DescribeDBInstances
  s3:ListAllMyBuckets
  cloudwatch:GetMetricStatistics
  ```
- **Credentials stored as:** `{ "access_key_id": "", "secret_access_key": "", "region": "" }`
- **Cost data:** AWS Cost Explorer API — always lags 24 hours, account for this
- **Gotcha:** Cost Explorer API has a $0.01 per API call charge after 10k calls/month. Cache aggressively. Never call it more than once per day per connection.

### GCP
- **SDK:** `google-cloud-billing`, `google-cloud-asset`
- **Required roles:** `roles/billing.viewer`, `roles/cloudasset.viewer`
- **Credentials stored as:** Service account JSON key (encrypted)
- **Gotcha:** Billing data is at the billing account level, not project level. One billing account can have multiple projects. Always link both.

### Azure
- **SDK:** `azure-mgmt-costmanagement`, `azure-mgmt-resource`
- **Required role:** `Cost Management Reader` (built-in)
- **Credentials stored as:** `{ "tenant_id": "", "client_id": "", "client_secret": "", "subscription_id": "" }`
- **Gotcha:** Azure cost data has a 8-24 hour delay. Never show "today's cost" as final.

### Snowflake
- **SDK:** `snowflake-connector-python`
- **Required:** Read access to `SNOWFLAKE.ACCOUNT_USAGE` schema
- **Key tables:** `WAREHOUSE_METERING_HISTORY`, `QUERY_HISTORY`, `DATABASE_STORAGE_USAGE_HISTORY`
- **Gotcha:** `ACCOUNT_USAGE` views have a 45-minute to 3-hour latency. Always note this in the UI.

---

## 🗑️ Unused Resource Detection Rules

Apply these rules during each scan. Mark resource as `waste_status = 'unused'` if ANY condition is met.

```python
UNUSED_RULES = {
  "aws": {
    "ec2_instance": [
      "status == 'stopped' AND last_state_change > 7 days ago",
      "CPU utilization avg < 2% over last 14 days",
    ],
    "eks_cluster": [
      "node_count > 0 AND running_pods == 0 for last 3 days",
    ],
    "ebs_volume": [
      "state == 'available' (not attached to any instance)",
    ],
    "rds_instance": [
      "no connections in last 7 days (via CloudWatch DatabaseConnections metric)",
    ],
    "s3_bucket": [
      "zero GET requests in last 30 days AND size > 1GB",
    ],
    "elastic_ip": [
      "not associated with any running instance",
    ],
  },
  "snowflake": {
    "warehouse": [
      "zero queries in last 7 days",
      "avg daily credits < 0.1 but auto-suspend disabled",
    ],
  },
  "gcp": {
    "compute_instance": [
      "status == 'TERMINATED' for > 7 days",
      "CPU utilization avg < 2% over 14 days",
    ],
    "persistent_disk": [
      "not attached to any instance",
    ],
  },
  "azure": {
    "virtual_machine": [
      "power_state == 'deallocated' for > 7 days",
    ],
    "managed_disk": [
      "disk_state == 'Unattached'",
    ],
  }
}
```

---

## 🤖 AI / Claude API Rules

**This is critical. Read before writing any AI-related code.**

### For Phase 1 (cost explanations):
```python
# Use claude-haiku-4-5 for cost explanations — it's fast and cheap
# Use this system prompt exactly:
COST_EXPLANATION_SYSTEM = """
You are a cloud cost analyst. You explain cloud resource waste in plain English.
Rules:
- Never mention AWS/GCP/Azure documentation — just explain the finding
- Always include the monthly dollar amount wasted
- Keep explanations under 2 sentences
- Be direct, not apologetic
- Do not suggest fixes — only explain what the waste is
"""
```

### For Phase 2 (RAG assistant):
```python
# Use claude-sonnet-4-6 for RAG answers — accuracy matters more than speed
# STRICT rules for the RAG system prompt:
RAG_SYSTEM = """
You are a cloud infrastructure assistant. You ONLY answer based on the
documentation chunks provided to you in the context.

STRICT RULES:
1. If the answer is not in the provided context, say exactly:
   "I don't have reliable documentation for this. Check: [relevant doc URL]"
2. Never infer, guess, or use training knowledge — only use provided context
3. Always end every answer with: "Source: [doc_title] — [doc_url]"
4. If context chunks are from different dates, use the most recent one
5. For config examples, only show configs that appear verbatim in the docs
"""
```

### Token/cost management:
- Cache identical questions for 24 hours — same question should never hit the API twice
- For cost explanations, max_tokens = 150 (never needs more)
- For RAG answers, max_tokens = 800
- Log every API call with token count to track spend

---

## 🔒 Security Rules

1. **Never store raw cloud credentials** — always encrypt with AES-256 before saving to DB
2. **Never log credentials** — mask in all log statements
3. **All cloud API calls are read-only** — never request write permissions, ever
4. **Razorpay webhooks** — always verify signature before processing
5. **Rate limiting** — add `slowapi` rate limiting to all public endpoints
6. **CORS** — only allow `cloudpilot.app` and `localhost:5173` origins

```python
# Credential encryption pattern — use this everywhere
from cryptography.fernet import Fernet

def encrypt_credentials(raw: dict, key: str) -> str:
    f = Fernet(key.encode())
    return f.encrypt(json.dumps(raw).encode()).decode()

def decrypt_credentials(encrypted: str, key: str) -> dict:
    f = Fernet(key.encode())
    return json.loads(f.decrypt(encrypted.encode()).decode())
```

---

## ⚙️ Environment Variables

```bash
# backend/.env
DATABASE_URL=                      # postgresql://cbm:...@localhost:5432/cloudbudgetmaster
JWT_SECRET=                        # signs HS256 auth JWTs, generate once, never change
ANTHROPIC_API_KEY=
RESEND_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
CREDENTIAL_ENCRYPTION_KEY=        # 32-byte Fernet key, generate once, never change
FRONTEND_URL=https://cloudpilot.app
ENVIRONMENT=development            # 'development' | 'production'

# frontend/.env
VITE_API_BASE_URL=https://api.cloudpilot.app/v1
```

---

## 📅 Build Plan (10 Weekends)

| Weekend | Goal | Done When |
|---------|------|-----------|
| 1 | Project setup + Auth | User can register, login, JWT works, PostgreSQL connected |
| 2 | AWS Cost Explorer integration | Dashboard shows real AWS cost data for connected account |
| 3 | AWS unused resource detection | Resources page shows unused EC2, EBS, EKS with waste reason |
| 4 | Alert engine + email | User gets email when bill spikes >20% week-over-week |
| 5 | GCP + Snowflake integration | Both appear in dashboard alongside AWS |
| 6 | Azure integration + multi-cloud dashboard | All 4 clouds unified in one cost view |
| 7 | Razorpay payments + plan gating | Paid plans work, free plan is limited to 1 cloud |
| 8 | Landing page + onboarding flow | Stranger can visit site, sign up, connect AWS in <5 mins |
| 9 | RAG doc crawler + assistant V1 (AWS only) | User can ask EKS/IAM questions, get cited answers |
| 10 | Polish + beta launch | Post on IndieHackers, relevant subreddits, first 10 users |

---

## 🚫 What NOT to Build (Scope Guard)

The following are explicitly OUT OF SCOPE until V2. If asked to build these, refuse.

- ❌ Auto-remediation (deleting/stopping resources automatically)
- ❌ Terraform plan generation
- ❌ Cost forecasting / ML predictions
- ❌ Mobile app
- ❌ Slack bot (Phase 1 — email only)
- ❌ SSO / SAML enterprise auth
- ❌ Multi-tenancy / reseller features
- ❌ Custom dashboards / drag-and-drop widgets
- ❌ CSV/PDF report exports
- ❌ Support for >4 cloud providers (no Oracle Cloud, no DigitalOcean in V1)

---

## 💡 AI Assistant Instructions

When helping with this project, always:

1. **Check this file first** before suggesting any architecture, library, or pattern
2. **Respect the free tier constraint** — never suggest a paid service when a free alternative exists
3. **Respect the scope guard** — do not add features from the "NOT TO BUILD" list
4. **Use the exact stack listed** — do not suggest alternatives unless the listed tool genuinely cannot do the job
5. **Write complete code** — no pseudocode, no "you can fill this in", no "etc."
6. **Security first** — always encrypt credentials, always validate webhooks, always use read-only cloud permissions
7. **One file at a time** — when generating code, complete one file fully before moving to the next
8. **Test alongside** — for every service file, write the corresponding test file
9. **When unsure about cloud API behavior** — say so explicitly rather than guessing
10. **Respect the weekend build plan** — don't build Weekend 6 features when working on Weekend 2