-- Migration 050: Create profiles table for user authentication
-- This table extends auth.users with application-specific user data

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  username TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'capper', 'admin')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  bio TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Add URL validation constraints
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

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simple, non-recursive)
-- Allow all authenticated users to read all profiles (for leaderboard, profile pages)
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (for the trigger)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_updated_at();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, email_verified, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to auto-create profile
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_profile_for_new_user();

-- Create function to sync email verification status
CREATE OR REPLACE FUNCTION sync_email_verified()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email verification
CREATE TRIGGER on_auth_user_email_verified
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
EXECUTE FUNCTION sync_email_verified();

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles extending auth.users with application-specific data';
COMMENT ON COLUMN profiles.id IS 'References auth.users(id)';
COMMENT ON COLUMN profiles.role IS 'User role: free (default), capper, or admin';
COMMENT ON COLUMN profiles.email_verified IS 'Synced from auth.users.email_confirmed_at';
COMMENT ON COLUMN profiles.bio IS 'User bio/description (max 500 characters recommended)';
COMMENT ON COLUMN profiles.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN profiles.instagram_url IS 'Instagram profile URL';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 050 complete: Created profiles table with auto-creation triggers';
END $$;

