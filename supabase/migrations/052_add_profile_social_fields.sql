-- Migration: Add social media fields and bio to profiles table
-- Adds bio, twitter_url, and instagram_url columns for profile customization

-- Add bio column (text field for user bio/description)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add Twitter URL column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS twitter_url TEXT;

-- Add Instagram URL column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Add constraints to validate URLs (optional but recommended)
ALTER TABLE profiles
ADD CONSTRAINT twitter_url_format CHECK (
  twitter_url IS NULL OR 
  twitter_url ~ '^https?://(www\.)?(twitter\.com|x\.com)/.+$'
);

ALTER TABLE profiles
ADD CONSTRAINT instagram_url_format CHECK (
  instagram_url IS NULL OR 
  instagram_url ~ '^https?://(www\.)?instagram\.com/.+$'
);

-- Add comment for documentation
COMMENT ON COLUMN profiles.bio IS 'User bio/description (max 500 characters recommended)';
COMMENT ON COLUMN profiles.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN profiles.instagram_url IS 'Instagram profile URL';

