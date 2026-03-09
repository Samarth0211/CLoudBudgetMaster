# CloudPilot

**Multi-cloud cost monitoring & infrastructure assistant.** Connects to AWS, GCP, Azure, and Snowflake via read-only APIs, detects unused/idle resources, sends cost spike alerts, and provides AI-powered optimization recommendations.

![Dark Theme Dashboard](https://img.shields.io/badge/theme-dark-0B0F1A?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/fastapi-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/supabase-postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)

---

## Features

- **Cost Dashboard** — Interactive chart with clickable daily drill-down, week-over-week trends, waste donut ring
- **Resource Scanner** — Detects stopped EC2s, idle instances, unattached EBS volumes, idle RDS, unassociated Elastic IPs
- **AI Chat Assistant** — Floating chat widget powered by Groq (free tier) for cost optimization Q&A
- **Smart Alerts** — Configurable rules for daily cost thresholds, cost spikes, and new unused resources with email notifications via Resend
- **Notification Center** — Real-time bell icon with unread count in the navbar
- **Savings Report** — Printable/PDF report with executive summary, waste breakdown, and recommendations
- **Cost Forecast** — Linear regression projection of next 30 days based on historical data
- **Tag-based Cost Grouping** — Group costs by AWS tags (Environment, Team, Project, etc.)
- **Resource Comparison** — Side-by-side comparison table for 2-4 resources
- **One-click Fix Actions** — AWS CLI commands and Terraform snippets for each waste type (copy-to-clipboard)
- **GCP Scanner** — Detects stopped VMs, unattached disks, idle Cloud SQL (requires GCP packages)
- **Onboarding Tour** — Step-by-step guided tour for first-time users
- **Dark Theme** — Premium Dribbble-inspired dark UI with glassmorphism, gradients, and animations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, Supabase (Postgres + Auth), httpx |
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, React Router, Recharts |
| **AI** | Groq API (Llama 3.3 70B) for chat & recommendations |
| **Email** | Resend API for alert notifications |
| **Cloud APIs** | AWS (boto3), GCP (google-cloud-*) — all read-only |
| **Auth** | Supabase Auth (JWT) with Row Level Security |
| **Security** | Fernet AES-256 encryption for stored credentials |
| **Deploy** | Vercel (frontend), Render (backend) |

---

## Project Structure

```
CloudPilot/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Settings from .env (pydantic-settings)
│   ├── dependencies.py            # Auth dependency (JWT validation)
│   ├── db/
│   │   ├── client.py              # Supabase client singleton
│   │   └── migrations/            # SQL migrations (run in Supabase SQL Editor)
│   ├── api/                       # Route handlers
│   │   ├── auth.py                # Login, register, profile
│   │   ├── connections.py         # Cloud connection CRUD + scan trigger
│   │   ├── dashboard.py           # Summary, trend, day breakdown, forecast, tags
│   │   ├── resources.py           # Resource list, detail, timeline, fix commands
│   │   ├── alerts.py              # Alert rules CRUD + events
│   │   └── assistant.py           # AI chat endpoint
│   ├── core/
│   │   ├── scanner_runner.py      # Dispatches scans to provider scanners
│   │   ├── alert_engine.py        # Evaluates alert rules against data
│   │   ├── email_service.py       # Sends emails via Resend
│   │   ├── encryption.py          # Fernet encrypt/decrypt for credentials
│   │   └── waste_calculator.py    # Cost waste calculation logic
│   └── services/
│       ├── aws/                   # AWS scanner, billing, unused detection
│       ├── gcp/                   # GCP scanner, billing, unused detection
│       └── ai/                    # Groq chat, recommendations, fix commands
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Routes and layout
│   │   ├── pages/                 # Dashboard, Resources, Connections, Alerts, etc.
│   │   ├── components/            # ChatWidget, OnboardingTour, Sidebar, Navbar
│   │   ├── hooks/                 # useAuth
│   │   ├── lib/                   # api.js (axios), supabase.js
│   │   └── index.css              # Custom animations, glassmorphism, print styles
│   └── index.html
├── .env.example                   # Sample backend env vars
├── frontend/.env.example          # Sample frontend env vars
└── ai_rules.md                    # Full architecture & design rules
```

---

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** and npm
- **Supabase account** (free tier works)
- **Groq API key** (free tier — for AI chat & recommendations)
- **AWS credentials** (read-only IAM user — for scanning)
- Optional: **Resend API key** (for email alerts)
- Optional: **GCP service account** (for GCP scanning)

---

## Getting API Keys

### 1. Supabase (Database + Auth) — Required

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** → pick a name and region → set a database password
3. Once created, go to **Settings → API**:
   - Copy **Project URL** → this is your `SUPABASE_URL`
   - Copy **anon/public key** → this is your `VITE_SUPABASE_ANON_KEY` (frontend)
   - Copy **service_role key** → this is your `SUPABASE_SERVICE_KEY` (backend — keep secret!)
4. Go to **SQL Editor** and run the migrations:
   - Paste contents of `backend/db/migrations/001_initial_schema.sql` → Run
   - Paste contents of `backend/db/migrations/002_alerts_chat_timeline.sql` → Run

### 2. Groq (AI Chat & Recommendations) — Required for AI features

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for free (generous free tier: 30 req/min)
3. Go to **API Keys** → Create new key
4. Copy it → this is your `GROQ_API_KEY`

### 3. AWS Credentials (Cloud Scanning) — Required for AWS scanning

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new IAM user with **programmatic access only**
3. Attach these **read-only** managed policies:
   - `ReadOnlyAccess` (or more granular: `AmazonEC2ReadOnlyAccess`, `AmazonRDSReadOnlyAccess`, `AWSBillingReadOnlyAccess`, `CloudWatchReadOnlyAccess`)
4. Copy the **Access Key ID** and **Secret Access Key**
5. You'll enter these in the CloudPilot UI when adding a connection (they're encrypted with AES-256 before storage)

### 4. Resend (Email Alerts) — Optional

1. Go to [resend.com](https://resend.com) and create a free account
2. Go to **API Keys** → Create new key
3. Copy it → this is your `RESEND_API_KEY`
4. To send from a custom domain, add and verify it in Resend's dashboard

### 5. GCP Service Account (GCP Scanning) — Optional

1. Go to [GCP Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a new service account with **Viewer** role
3. Create a JSON key → download it
4. You'll paste this JSON in the CloudPilot UI when adding a GCP connection
5. Install additional Python packages: `pip install google-cloud-bigquery google-cloud-compute google-cloud-sql-admin`

### 6. Credential Encryption Key — Required

Generate a Fernet key for encrypting stored cloud credentials:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output → this is your `CREDENTIAL_ENCRYPTION_KEY`

---

## Setup & Installation

### 1. Clone the repo

```bash
git clone https://github.com/samarth0211/CloudPilot.git
cd CloudPilot
```

### 2. Backend setup

```bash
cd backend
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Copy the sample env and fill in your keys:

```bash
cp ../.env.example .env
# Edit .env with your actual API keys
```

Run the database migrations in Supabase SQL Editor (see step 1 under "Getting API Keys").

Start the dev server:

```bash
uvicorn backend.main:app --reload
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

Copy the sample env:

```bash
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

Start the dev server:

```bash
npm run dev
# App available at http://localhost:5173
```

### 4. First-time usage

1. Open `http://localhost:5173` → Register a new account
2. Go to **Connections** → Click **Add Connection**
3. Select **AWS** → Enter your read-only IAM credentials
4. Click **Scan Now** to discover resources and costs
5. Go to **Dashboard** to see your spending overview
6. Click chart points to drill into daily cost breakdowns
7. Go to **Alerts** to set up cost threshold notifications
8. Use the **AI chat** (bottom-right bubble) to ask about your costs

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (secret) |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes | Fernet key for encrypting cloud credentials |
| `GROQ_API_KEY` | Yes* | Groq API key for AI features (*app works without, AI disabled) |
| `RESEND_API_KEY` | No | Resend API key for email alerts |
| `ANTHROPIC_API_KEY` | No | Anthropic key (reserved for future RAG features) |
| `RAZORPAY_KEY_ID` | No | Razorpay key for payments (not yet active) |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret for payments (not yet active) |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: `http://localhost:5173`) |
| `ENVIRONMENT` | No | `development` or `production` (default: `development`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (safe to expose) |
| `VITE_API_BASE_URL` | No | Backend API URL (default: `http://localhost:8000/v1`) |

---

## Available Scripts

### Backend

```bash
cd backend
uvicorn backend.main:app --reload        # Dev server at :8000
pytest tests/                            # Run all tests
pytest tests/test_aws_scanner.py -v      # Single test file
```

### Frontend

```bash
cd frontend
npm run dev                              # Dev server at :5173
npm run build                            # Production build
npm run preview                          # Preview production build
npm run lint                             # ESLint check
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/auth/register` | Register new user |
| `POST` | `/v1/auth/login` | Login |
| `GET` | `/v1/connections` | List cloud connections |
| `POST` | `/v1/connections` | Add cloud connection |
| `POST` | `/v1/connections/:id/scan` | Trigger scan |
| `GET` | `/v1/dashboard/summary` | Cost & waste summary |
| `GET` | `/v1/dashboard/trend` | Daily cost trend (30/60/90 days) |
| `GET` | `/v1/dashboard/top-waste` | Top wasteful resources |
| `GET` | `/v1/dashboard/day/:date` | Per-service cost breakdown for a date |
| `GET` | `/v1/dashboard/forecast` | Cost forecast (next 30 days) |
| `GET` | `/v1/dashboard/cost-by-tag` | Costs grouped by tag key |
| `GET` | `/v1/resources` | List resources (filterable, paginated) |
| `GET` | `/v1/resources/:id` | Resource detail |
| `GET` | `/v1/resources/:id/timeline` | Resource status history |
| `GET` | `/v1/resources/:id/fix-commands` | CLI & Terraform fix snippets |
| `POST` | `/v1/resources/:id/recommendation` | AI-powered fix recommendation |
| `GET` | `/v1/alerts/rules` | List alert rules |
| `POST` | `/v1/alerts/rules` | Create alert rule |
| `PUT` | `/v1/alerts/rules/:id` | Update alert rule |
| `DELETE` | `/v1/alerts/rules/:id` | Delete alert rule |
| `GET` | `/v1/alerts/events` | List alert events |
| `POST` | `/v1/alerts/events/:id/dismiss` | Dismiss alert |
| `POST` | `/v1/alerts/events/dismiss-all` | Dismiss all alerts |
| `POST` | `/v1/assistant/chat` | AI chat message |

---

## Security

- All cloud API calls are **read-only** — CloudPilot never modifies your infrastructure
- Cloud credentials are **AES-256 encrypted** (Fernet) before database storage
- Credentials are **never logged** — masked in all outputs
- All database tables use **Row Level Security (RLS)** — users can only access their own data
- JWT authentication via Supabase Auth on every API call
- Fix commands are **displayed, never executed** — you review and run them yourself

---

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
5. Deploy

### Backend (Render)

1. Connect repo to [Render](https://render.com)
2. Create a new **Web Service**
3. Set build command: `pip install -r backend/requirements.txt`
4. Set start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `backend/.env`
6. Deploy

---

## License

MIT

---

Built with Claude Code.
