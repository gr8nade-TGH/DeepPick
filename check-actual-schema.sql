-- Check what columns actually exist in capper_profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'capper_profiles' 
ORDER BY ordinal_position;

-- Also check if there are any existing records
SELECT COUNT(*) as total_records FROM capper_profiles;

-- Check what the actual table structure looks like
\d capper_profiles;
