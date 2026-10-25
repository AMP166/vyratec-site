-- Shared enquiry protection uses the existing SMS_ALERTS D1 binding.
-- Identifiers are keyed hashes. No IP, email address or form content is stored.
CREATE TABLE IF NOT EXISTS enquiry_ip_attempts (
  attempt_id TEXT PRIMARY KEY NOT NULL,
  ip_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS enquiry_ip_attempts_key_time ON enquiry_ip_attempts(ip_key, created_at);
CREATE INDEX IF NOT EXISTS enquiry_ip_attempts_time ON enquiry_ip_attempts(created_at);

-- Seven-day receipts permit safe recovery of accepted or uncertain submissions.
-- New provider attempts stop after 23 hours, before Resend's 24-hour key expiry.
CREATE TABLE IF NOT EXISTS enquiry_receipts (
  request_key TEXT PRIMARY KEY NOT NULL,
  email_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'sending', 'unknown', 'accepted', 'rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  first_attempt_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  receipt_id TEXT
);
CREATE INDEX IF NOT EXISTS enquiry_receipts_email_time ON enquiry_receipts(email_key, created_at);
CREATE INDEX IF NOT EXISTS enquiry_receipts_time ON enquiry_receipts(created_at);
