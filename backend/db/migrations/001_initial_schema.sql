-- CloudPilot Initial Schema
-- Run this in the Supabase SQL Editor

-- Users (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'team')),
  razorpay_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow service role to insert profiles (for registration)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Auto-create profile on user signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Cloud account connections
CREATE TABLE IF NOT EXISTS cloud_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'gcp', 'azure', 'snowflake')),
  display_name TEXT,
  credentials_encrypted TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'paused')),
  last_scanned_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cloud_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own connections"
  ON cloud_connections FOR ALL
  USING (auth.uid() = user_id);

-- All discovered cloud resources
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
  waste_status TEXT CHECK (
    waste_status IN ('active', 'unused', 'idle', 'oversized', 'orphaned')
  ),
  waste_reason TEXT,
  waste_monthly_cost_usd NUMERIC(10, 4),
  metadata JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, resource_id)
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own resources"
  ON resources FOR ALL
  USING (auth.uid() = user_id);

-- Daily cost snapshots per connection
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

ALTER TABLE cost_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshots"
  ON cost_snapshots FOR ALL
  USING (auth.uid() = user_id);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES cloud_connections(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (
    rule_type IN ('cost_spike', 'unused_resource', 'budget_threshold', 'new_resource')
  ),
  threshold_value NUMERIC(10, 4),
  threshold_unit TEXT,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_slack BOOLEAN DEFAULT FALSE,
  slack_webhook_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alert rules"
  ON alert_rules FOR ALL
  USING (auth.uid() = user_id);

-- Alert events
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT FALSE
);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alert events"
  ON alert_events FOR ALL
  USING (auth.uid() = user_id);

-- Phase 2: RAG document chunks
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  doc_url TEXT NOT NULL,
  doc_title TEXT,
  chunk_text TEXT NOT NULL,
  chunk_index INT,
  embedding vector(1536),
  last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doc_url, chunk_index)
);

CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx
  ON doc_chunks USING ivfflat (embedding vector_cosine_ops);

-- RAG answer cache
CREATE TABLE IF NOT EXISTS rag_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
