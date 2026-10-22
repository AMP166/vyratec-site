-- Apply to the D1 database bound as SMS_ALERTS before enabling owner alerts.
-- Only the mail-provider receipt, fixed delivery state and claim timestamp persist.
CREATE TABLE IF NOT EXISTS callback_sms_alerts (
  receipt_id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('claimed', 'queued', 'rejected', 'unknown')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS callback_sms_alerts_created_at ON callback_sms_alerts (created_at);
