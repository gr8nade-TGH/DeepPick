# DeepPick Authentication System - Complete Reference

## 🏗️ **System Architecture**

### **Tech Stack**
- **Frontend**: Next.js 14 (App Router) with React Server Components
- **Backend**: Supabase Auth + PostgreSQL
- **Security**: Row Level Security (RLS) policies
- **Session Management**: Server-side with client-side sync

---

## 📊 **Database Schema**

### **`profiles` Table** (public schema)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'free', -- 'free' | 'capper' | 'admin'
  email_verified BOOLEAN DEFAULT false,
  avatar_url TEXT,
  bio TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **User Roles**
- **`free`** (default): Can view picks, leaderboard (read-only)
- **`capper`**: Can make picks, appear on leaderboard, track performance
- **`admin`**: Full system access, capper management, monitoring

---

## 🔧 **Critical Database Triggers**

### **Auto-Create Profile on Signup**
**Trigger**: `on_auth_user_created` on `auth.users` table (INSERT)

```sql
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- CRITICAL: Allows access to public.profiles from auth schema
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, email_verified, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'free')
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;  -- Don't break auth flow on profile creation failure
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_new_user();
```

**Why `SET search_path = public` is critical:**
- Trigger runs in `auth` schema context
- Without explicit search_path, it can't find `public.profiles` table
- Results in error: "relation 'profiles' does not exist"

### **Sync Email Verification**
**Trigger**: `on_auth_user_email_verified` on `auth.users` table (UPDATE)

```sql
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
    UPDATE public.profiles
    SET email_verified = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error syncing email verification for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
```

---

## 🔒 **Row Level Security (RLS) Policies**

### **Profiles Table Policies**

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. Allow service_role/supabase_auth_admin to INSERT (for triggers)
CREATE POLICY "Allow service role to insert profiles" 
ON profiles FOR INSERT 
TO service_role, supabase_auth_admin 
WITH CHECK (true);

-- 2. Allow service_role to UPDATE (for email verification sync)
CREATE POLICY "Allow service role to update profiles" 
ON profiles FOR UPDATE 
TO service_role, supabase_auth_admin 
USING (true) WITH CHECK (true);

-- 3. Authenticated users can view all profiles
CREATE POLICY "Authenticated users can view all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- 4. Users can insert their own profile (fallback)
CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
TO public 
WITH CHECK ((auth.uid() = id) OR (auth.uid() IS NULL));

-- 5. Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);
```

**Why these policies are critical:**
- Policies #1 and #2 allow trigger functions (running as `supabase_auth_admin`) to create/update profiles
- Without these, signup fails with RLS permission errors

---

## 🎯 **Auth Context** (`src/contexts/auth-context.tsx`)

### **Key Features**
1. **Server-side initial state** - Prevents hydration mismatches
2. **Client-side Supabase client** - Syncs auth state changes
3. **Smart profile fetching** - Prevents unnecessary refetches
4. **3-second timeout** - Prevents infinite hangs on profile queries

### **Critical Logic: Prevent Unnecessary Refetches**

```typescript
// In onAuthStateChange listener
if (newSession?.user) {
  setProfile((currentProfile) => {
    const currentUserId = newSession.user.id
    const hasProfileForUser = currentProfile?.id === currentUserId
    
    if (!hasProfileForUser) {
      // Only fetch if we don't have profile for this user
      fetchProfile(currentUserId).then((profileData) => {
        if (mounted) {
          setProfile(profileData)
          setLoading(false)
        }
      })
      return currentProfile
    } else {
      // Skip refetch - prevents timeout/flash issues
      console.log('[AuthContext] Profile already loaded - skipping refetch')
      setLoading(false)
      return currentProfile
    }
  })
}
```

**Why this matters:**
- Auth state changes fire multiple events: `SIGNED_IN`, `INITIAL_SESSION`
- Without this check, profile is refetched on every event
- Refetch can timeout (3s), causing profile to become `null` temporarily
- This causes "Sign In Required" flash on protected pages

---

## 🛣️ **Middleware** (`src/middleware.ts`)

### **Protected Routes**

```typescript
// Auth required
const authRequiredRoutes = ['/make-picks', '/profile', '/settings']

// Capper role required
const capperRoutes = ['/make-picks']

// Admin role required
const adminRoutes = ['/admin', '/cappers/shiva/management', '/cappers/ifrit/management', '/monitoring']
```

### **Redirect Logic**
1. **Not logged in + auth required** → `/login?redirect={path}`
2. **Free user + capper route** → `/upgrade?reason=capper_required`
3. **Non-admin + admin route** → `/`

---

## 📝 **Sign Up Flow**

### **File**: `src/app/signup/page.tsx`

```typescript
const handleSignUp = async (e: FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

  const { error } = await signUp(email, password, fullName)

  if (error) {
    setError(error.message)
    setLoading(false)
  } else {
    // Success - auth context handles redirect
    router.push('/')
  }
}
```

### **Backend Flow**
1. `supabase.auth.signUp()` creates user in `auth.users`
2. **Trigger fires**: `create_profile_for_new_user()` inserts into `profiles`
3. Auth context receives `SIGNED_IN` event
4. Profile already exists (from trigger), no refetch needed
5. User redirected to dashboard

---

## 🔑 **Login Flow**

### **File**: `src/app/login/page.tsx`

```typescript
const handleLogin = async (e: FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

  const { error } = await signIn(email, password)

  if (error) {
    setError(error.message)
    setLoading(false)
  } else {
    // Force full page reload to ensure auth state is initialized
    window.location.href = '/'
  }
}
```

### **Backend Flow**
1. `supabase.auth.signInWithPassword()` validates credentials
2. Auth context receives `SIGNED_IN` event
3. Fetches profile from `profiles` table (if not already loaded)
4. User redirected to dashboard

---

## 🐛 **Common Issues & Fixes**

### **Issue 1: "relation 'profiles' does not exist"**
**Cause**: Trigger function can't find `public.profiles` from `auth` schema  
**Fix**: Add `SET search_path = public` to trigger function

### **Issue 2: RLS blocking trigger inserts**
**Cause**: `supabase_auth_admin` role doesn't have INSERT permission  
**Fix**: Add RLS policy for `service_role, supabase_auth_admin`

### **Issue 3: "Sign In Required" flash on protected pages**
**Cause**: Profile refetch timeout causes profile to become `null` temporarily  
**Fix**: Skip refetch if profile already exists for current user

### **Issue 4: Profile fetch timeout**
**Cause**: Supabase query hangs indefinitely  
**Fix**: Add 3-second timeout with `Promise.race()`

---

## 🚀 **Next Steps: Google Sign-In**

### **Requirements**
1. Enable Google OAuth in Supabase dashboard
2. Add Google Client ID/Secret to Supabase
3. Update auth context to support `signInWithGoogle()`
4. Add Google sign-in button to login/signup pages
5. **CRITICAL**: Ensure trigger still creates profile for OAuth users

### **Implementation Notes**
- OAuth users don't have password
- `raw_user_meta_data` contains Google profile info
- Trigger should extract `full_name` from Google metadata
- Email is automatically verified for Google users

---

## 📚 **Key Files Reference**

- **Auth Context**: `src/contexts/auth-context.tsx`
- **Middleware**: `src/middleware.ts`
- **Login Page**: `src/app/login/page.tsx`
- **Signup Page**: `src/app/signup/page.tsx`
- **Upgrade Page**: `src/app/upgrade/page.tsx`
- **Database Triggers**: `supabase/migrations/` (look for profile creation triggers)

---

## 🎯 **Testing Checklist**

- [ ] Sign up with email/password creates profile
- [ ] Login with email/password loads profile
- [ ] Protected routes redirect to login when not authenticated
- [ ] Capper routes redirect to upgrade for free users
- [ ] Admin routes redirect to home for non-admins
- [ ] No "Sign In Required" flash on protected pages
- [ ] Profile loads without timeout errors
- [ ] Logout clears session and redirects to login

---

**Last Updated**: 2025-11-13  
**Auth System Version**: v2.0 (Post-RLS Fix)

