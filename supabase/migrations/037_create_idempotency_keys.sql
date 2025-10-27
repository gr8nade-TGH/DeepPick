-- Create idempotency_keys table with correct types
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  run_id TEXT NOT NULL,
  step TEXT NOT NULL,
  key TEXT NOT NULL,
  response_json JSONB,
  status_code INTEGER,
  response_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (run_id, step, key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_idempotency_run_id ON public.idempotency_keys(run_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_step ON public.idempotency_keys(step);
CREATE INDEX IF NOT EXISTS idx_idempotency_run_step ON public.idempotency_keys(run_id, step);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Allow all operations
CREATE POLICY "Allow all operations on idempotency_keys" 
ON public.idempotency_keys 
FOR ALL USING (true);

COMMENT ON TABLE public.idempotency_keys IS 'Idempotency cache for SHIVA v1 API responses';


