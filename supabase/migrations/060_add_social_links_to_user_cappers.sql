-- Migration 060: Add social_links to user_cappers table
-- This enables cappers to share their social media profiles on their public profile page

-- Add social_links column as JSONB
ALTER TABLE user_cappers
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN user_cappers.social_links IS 'Social media links for capper public profile (twitter, instagram, youtube, website)';

-- Example structure:
-- {
--   "twitter": "https://twitter.com/username",
--   "instagram": "https://instagram.com/username",
--   "youtube": "https://youtube.com/@username",
--   "website": "https://example.com"
-- }

