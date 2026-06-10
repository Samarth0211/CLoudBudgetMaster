-- Self-hosted PostgreSQL schema.
-- No external-auth dependency, no RLS — the FastAPI backend owns auth + isolation.
-- gen_random_uuid() is built-in on PostgreSQL 13+.

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'team', 'pro', 'enterprise')),
  promo_code TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'gcp', 'azure', 'snowflake')),
  display_name TEXT,
  credentials_encrypted TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  last_scanned_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT,
  region TEXT,
  status TEXT,
  monthly_cost_usd NUMERIC(10, 4),
  waste_status TEXT,
  waste_reason TEXT,
  waste_monthly_cost_usd NUMERIC(10, 4),
  metadata JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, resource_id)
);

CREATE TABLE IF NOT EXISTS cost_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_cost_usd NUMERIC(10, 4),
  waste_cost_usd NUMERIC(10, 4),
  resource_count INT,
  unused_resource_count INT,
  raw_breakdown JSONB,
  UNIQUE(connection_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  threshold_value NUMERIC(10, 4),
  threshold_unit TEXT,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_slack BOOLEAN DEFAULT FALSE,
  slack_webhook_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  label TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  current_value NUMERIC DEFAULT 0,
  threshold NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  status TEXT,
  metrics JSONB DEFAULT '{}',
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_snapshots_lookup ON resource_snapshots(resource_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_resources_connection ON resources(connection_id);
CREATE INDEX IF NOT EXISTS idx_cost_snapshots_connection ON cost_snapshots(connection_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_user ON alert_events(user_id);

-- Marketing blog (SEO). Authored via the admin UI; published posts are also
-- rendered to static HTML in the nginx dist for crawlers/social previews.
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT '',          -- markdown source
  category TEXT DEFAULT 'FinOps',
  cover_image TEXT DEFAULT '',
  author TEXT DEFAULT 'CloudBudgetMaster',
  meta_description TEXT DEFAULT '',
  keywords TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status, published_at DESC);

-- Email preference for the daily blog digest (opt-out).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blog_opt_out BOOLEAN DEFAULT FALSE;

-- Promo-code trials (e.g. the AWS cold-email campaign). A code grants a temporary
-- paid plan; plan_expires_at drives the auto-downgrade back to free.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,                 -- stored upper-case
  plan TEXT NOT NULL DEFAULT 'pro',
  trial_days INT NOT NULL DEFAULT 7,
  max_per_domain INT NOT NULL DEFAULT 1, -- redemptions allowed per email domain
  valid_until TIMESTAMPTZ,               -- offer end; NULL = no end
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per redemption; UNIQUE(code, email_domain) enforces the per-domain cap.
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (code, email_domain)
);

-- Campaign code: 7-day Pro trial, one per company domain, offer ends 20 Jun 2026 IST.
INSERT INTO promo_codes (code, plan, trial_days, max_per_domain, valid_until, active)
VALUES ('CBMPRO7', 'pro', 7, 1, '2026-06-20 23:59:59+05:30', TRUE)
ON CONFLICT (code) DO UPDATE SET valid_until = EXCLUDED.valid_until, active = TRUE;
