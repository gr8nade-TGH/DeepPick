-- Fix factors table with all required columns
ALTER TABLE public.factors 
ADD COLUMN IF NOT EXISTS factor_no INTEGER,
ADD COLUMN IF NOT EXISTS normalized_value DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS caps_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cap_reason TEXT,
ADD COLUMN IF NOT EXISTS weight_applied DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS raw_values_json JSONB,
ADD COLUMN IF NOT EXISTS parsed_values_json JSONB,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS factor_category TEXT,
ADD COLUMN IF NOT EXISTS factor_metadata JSONB,
ADD COLUMN IF NOT EXISTS factor_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS factor_priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS factor_group TEXT,
ADD COLUMN IF NOT EXISTS factor_tags TEXT[];

-- Update comments
COMMENT ON COLUMN public.factors.factor_no IS 'Sequential number for the factor';
COMMENT ON COLUMN public.factors.normalized_value IS 'Normalized factor value';
COMMENT ON COLUMN public.factors.caps_applied IS 'Whether caps were applied to the factor';
COMMENT ON COLUMN public.factors.cap_reason IS 'Reason for applying caps';
COMMENT ON COLUMN public.factors.weight_applied IS 'Weight applied to the factor';
COMMENT ON COLUMN public.factors.raw_values_json IS 'Raw values as JSON';
COMMENT ON COLUMN public.factors.parsed_values_json IS 'Parsed values as JSON';
COMMENT ON COLUMN public.factors.notes IS 'Additional notes';
COMMENT ON COLUMN public.factors.factor_category IS 'Category or type of the factor';
COMMENT ON COLUMN public.factors.factor_metadata IS 'Additional metadata for the factor';
COMMENT ON COLUMN public.factors.factor_status IS 'Status of the factor';
COMMENT ON COLUMN public.factors.factor_priority IS 'Priority level of the factor';
COMMENT ON COLUMN public.factors.factor_group IS 'Group or collection the factor belongs to';
COMMENT ON COLUMN public.factors.factor_tags IS 'Tags associated with the factor';
