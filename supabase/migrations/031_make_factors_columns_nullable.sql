-- Make factor_key and factor_name nullable in the factors table
ALTER TABLE public.factors 
ALTER COLUMN factor_key DROP NOT NULL,
ALTER COLUMN factor_name DROP NOT NULL;

-- Set defaults for existing columns that might be required
ALTER TABLE public.factors 
ALTER COLUMN caps_applied SET DEFAULT false;

COMMENT ON COLUMN public.factors.factor_key IS 'Unique identifier for the factor type (optional)';
COMMENT ON COLUMN public.factors.factor_name IS 'Human-readable name of the factor (optional)';
COMMENT ON COLUMN public.factors.game_id IS 'Reference to the game this factor belongs to (now optional to allow flexibility)';
