-- Add missing columns to runs table
ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS conf7 DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS conf_final DECIMAL(5, 2);

-- Add any other common columns that might be needed
ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS units INTEGER,
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS pick_type TEXT,
ADD COLUMN IF NOT EXISTS selection TEXT;

