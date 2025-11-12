-- ═══════════════════════════════════════════════════════════
-- FIX SIGNUP 500 ERROR - RLS POLICY BLOCKING TRIGGER
-- ═══════════════════════════════════════════════════════════
-- ISSUE: Users cannot sign up - getting 500 error
-- ROOT CAUSE: The create_profile_for_new_user() trigger tries to INSERT
--             into profiles table, but the RLS policy blocks it because
--             auth.uid() returns NULL during signup (user not authenticated yet)
-- SOLUTION: Allow INSERT when auth.uid() IS NULL (trigger context during signup)
-- ═══════════════════════════════════════════════════════════

-- Drop existing INSERT policy that blocks trigger
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Recreate with NULL check to allow trigger inserts during signup
-- CRITICAL: Remove "TO authenticated" so policy applies to ALL roles (including postgres/service role)
-- The trigger runs as postgres (SECURITY DEFINER), not as authenticated role
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id           -- Users can insert their own profile
    OR auth.uid() IS NULL     -- Trigger can insert during signup when user not authenticated yet
  );

COMMENT ON POLICY "Users can insert own profile" ON profiles IS 
  'Allows authenticated users to insert their own profile (auth.uid() = id) AND allows the create_profile_for_new_user() trigger to insert during signup when auth.uid() is NULL (user being created but not yet authenticated)';

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════
-- The trigger function create_profile_for_new_user() has SECURITY DEFINER
-- which means it runs with elevated privileges, but RLS still applies.
-- By allowing auth.uid() IS NULL, we permit the trigger to insert profiles
-- during the signup process when the user record exists but isn't authenticated yet.
-- 
-- This is a standard Supabase pattern for auth triggers.
-- ═══════════════════════════════════════════════════════════

