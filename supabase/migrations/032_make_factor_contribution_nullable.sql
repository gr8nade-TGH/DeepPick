-- Make factor_contribution nullable in the factors table
ALTER TABLE public.factors 
ALTER COLUMN factor_contribution DROP NOT NULL;

-- Set a default value for factor_contribution
ALTER TABLE public.factors 
ALTER COLUMN factor_contribution SET DEFAULT 0;

-- Make factor_value nullable as well
ALTER TABLE public.factors 
ALTER COLUMN factor_value DROP NOT NULL;

-- Set a default value for factor_value
ALTER TABLE public.factors 
ALTER COLUMN factor_value SET DEFAULT 0;

