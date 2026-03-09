-- Migration 002: Alerts, Chat, Resource Timeline
-- Run in Supabase SQL Editor

-- Chat messages for AI assistant history
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- Resource snapshots for timeline tracking
CREATE TABLE IF NOT EXISTS resource_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  status TEXT,
  metrics JSONB DEFAULT '{}',
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_snapshots_lookup
  ON resource_snapshots(resource_id, snapshot_date);
ALTER TABLE resource_snapshots ENABLE ROW LEVEL SECURITY;
-- RLS: users can read snapshots for resources they own (via connection)
CREATE POLICY "Users can read own resource snapshots" ON resource_snapshots
  FOR SELECT USING (
    resource_id IN (
      SELECT r.id FROM resources r
      JOIN cloud_connections cc ON r.connection_id = cc.id
      WHERE cc.user_id = auth.uid()
    )
  );

-- Add label column to alert_rules if not exists
DO $$ BEGIN
  ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS label TEXT DEFAULT '';
  ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add dismissed column to alert_events if not exists
DO $$ BEGIN
  ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT false;
  ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0;
  ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS threshold NUMERIC DEFAULT 0;
END $$;
