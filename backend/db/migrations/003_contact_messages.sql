-- Contact / book-a-demo submissions from the public site.
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  message TEXT NOT NULL,
  handled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: the backend writes with the service-role key (bypasses RLS). These
-- policies only govern direct anon/client access — keep reads locked down.
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anonymous INSERTs (in case the form ever posts directly via the anon key).
DROP POLICY IF EXISTS "Anyone can submit a contact message" ON contact_messages;
CREATE POLICY "Anyone can submit a contact message"
  ON contact_messages FOR INSERT
  WITH CHECK (true);
-- No SELECT policy => no one can read these except the service role (admin).
