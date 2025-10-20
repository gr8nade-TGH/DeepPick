-- Add status_code and response_hash to idempotency_keys
ALTER TABLE idempotency_keys
ADD COLUMN IF NOT EXISTS status_code SMALLINT,
ADD COLUMN IF NOT EXISTS response_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_idempo_run_step ON idempotency_keys(run_id, step);


