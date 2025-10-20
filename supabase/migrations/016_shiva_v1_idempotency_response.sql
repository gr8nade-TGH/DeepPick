-- Add response_json to idempotency_keys for storing canonical responses
ALTER TABLE idempotency_keys
ADD COLUMN IF NOT EXISTS response_json JSONB;


