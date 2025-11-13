# Google OAuth Setup Guide for DeepPick

## ✅ **Current Status**

The code is **already implemented** and ready to go! Here's what's already done:

- ✅ `signInWithGoogle()` method in AuthContext
- ✅ Google sign-in button on login page
- ✅ Google sign-up button on signup page
- ✅ OAuth callback route (`/auth/callback`)
- ✅ Database trigger extracts `full_name` and `avatar_url` from OAuth metadata
- ✅ RLS policies allow trigger to create profiles

**All you need to do is enable Google OAuth in Supabase!**

---

## 🔧 **Step 1: Get Google OAuth Credentials**

### **1.1 Go to Google Cloud Console**
- URL: https://console.cloud.google.com/
- Sign in with your Google account

### **1.2 Create or Select Project**
- Click the project dropdown at the top
- Click **"New Project"** or select existing project
- Project name: **DeepPick** (or any name you prefer)
- Click **Create**

### **1.3 Configure OAuth Consent Screen**
- Navigate to **APIs & Services** → **OAuth consent screen**
- User Type: Select **External**
- Click **Create**

**Fill in the form:**
- **App name**: `DeepPick`
- **User support email**: Your email address
- **App logo**: (Optional - skip for now)
- **App domain**: 
  - Application home page: `https://deep-pick.vercel.app`
  - Privacy policy: (Optional - skip for now)
  - Terms of service: (Optional - skip for now)
- **Authorized domains**: 
  - `vercel.app`
  - `supabase.co`
- **Developer contact information**: Your email address
- Click **Save and Continue**

**Scopes:**
- Click **Add or Remove Scopes**
- Select:
  - `userinfo.email` - See your primary Google Account email address
  - `userinfo.profile` - See your personal info, including any personal info you've made publicly available
- Click **Update**
- Click **Save and Continue**

**Test users:** (Optional for development)
- Add your email if you want to test before publishing
- Click **Save and Continue**

**Summary:**
- Review and click **Back to Dashboard**

### **1.4 Create OAuth Client ID**
- Navigate to **APIs & Services** → **Credentials**
- Click **+ Create Credentials** → **OAuth client ID**

**Configure:**
- Application type: **Web application**
- Name: `DeepPick Production`

**Authorized JavaScript origins:**
```
https://deep-pick.vercel.app
```

**Authorized redirect URIs:**
```
https://xckbsyeaywrfzvcahhtk.supabase.co/auth/v1/callback
```

- Click **Create**

### **1.5 Copy Credentials**
A popup will appear with your credentials:
- **Client ID**: `123456789-abc123xyz.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-abc123xyz...`

**⚠️ IMPORTANT: Copy both values - you'll need them in the next step!**

---

## 🔐 **Step 2: Enable Google Provider in Supabase**

### **2.1 Go to Supabase Dashboard**
- URL: https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk
- Navigate to **Authentication** → **Providers**

### **2.2 Configure Google Provider**
- Scroll down to find **Google** in the provider list
- Toggle **Enable Sign in with Google** to **ON**

**Fill in the form:**
- **Client ID (for OAuth)**: Paste the Client ID from Step 1.5
- **Client Secret (for OAuth)**: Paste the Client Secret from Step 1.5
- **Redirect URL**: (Already filled - should be `https://xckbsyeaywrfzvcahhtk.supabase.co/auth/v1/callback`)

- Click **Save**

---

## 🧪 **Step 3: Test Google Sign-In**

### **3.1 Test on Login Page**
1. Go to: https://deep-pick.vercel.app/login
2. Click the **"Continue with Google"** button (white button with Google logo)
3. Select your Google account
4. Click **Allow** to authorize DeepPick
5. You should be redirected to the dashboard (`/`)

### **3.2 Verify Profile Created**
Run this query in Supabase SQL Editor to check your profile:

```sql
SELECT 
  id,
  email,
  full_name,
  avatar_url,
  role,
  email_verified,
  created_at
FROM profiles
WHERE email = 'YOUR_EMAIL@gmail.com'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected result:**
- ✅ `email`: Your Google email
- ✅ `full_name`: Your Google display name
- ✅ `avatar_url`: Your Google profile picture URL
- ✅ `role`: `free` (default)
- ✅ `email_verified`: `true` (Google emails are pre-verified)

### **3.3 Test on Signup Page**
1. Sign out (if logged in)
2. Go to: https://deep-pick.vercel.app/signup
3. Click **"Sign up with Google"** button
4. Should work the same as login (OAuth doesn't distinguish between signup/login)

---

## 🐛 **Troubleshooting**

### **Issue: "Error 400: redirect_uri_mismatch"**
**Cause**: The redirect URI in Google Console doesn't match Supabase's callback URL

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth Client ID
3. Make sure **Authorized redirect URIs** includes:
   ```
   https://xckbsyeaywrfzvcahhtk.supabase.co/auth/v1/callback
   ```
4. Save and try again

### **Issue: "Access blocked: This app's request is invalid"**
**Cause**: OAuth consent screen not configured or app not published

**Fix**:
1. Go to Google Cloud Console → OAuth consent screen
2. Complete all required fields
3. If testing, add your email to **Test users**
4. If ready for production, click **Publish App**

### **Issue: Profile not created after Google sign-in**
**Cause**: Database trigger failed

**Fix**:
1. Check Supabase logs: Dashboard → Logs → Database
2. Look for errors related to `create_profile_for_new_user`
3. Verify RLS policies allow `service_role` to INSERT into `profiles`

### **Issue: "Sign In Required" flash after Google login**
**Cause**: Profile fetch timeout (should be fixed already)

**Fix**: Already fixed in AuthContext - profile refetch is skipped if already loaded

---

## 📊 **How OAuth Metadata is Handled**

When a user signs in with Google, Supabase stores their info in `auth.users.raw_user_meta_data`:

```json
{
  "full_name": "John Doe",
  "avatar_url": "https://lh3.googleusercontent.com/a/...",
  "email": "john@gmail.com",
  "email_verified": true,
  "provider_id": "123456789",
  "sub": "123456789"
}
```

Our trigger function extracts:
- `full_name` → `profiles.full_name`
- `avatar_url` → `profiles.avatar_url`
- `email` → `profiles.email`
- `email_verified` → `profiles.email_verified` (always `true` for Google)

---

## 🔒 **Security Notes**

1. **Client Secret is sensitive** - Never commit it to Git or expose it client-side
2. **Redirect URI must match exactly** - Supabase validates this for security
3. **Email is pre-verified** - Google users don't need email confirmation
4. **No password** - OAuth users can only sign in via Google (can't use email/password)

---

## 🚀 **Next Steps After Google OAuth Works**

1. **Twitter OAuth** (already implemented in code, just needs Twitter API credentials)
2. **Email verification enforcement** (optional - currently not required)
3. **Profile picture upload** (for email/password users who don't have OAuth avatar)
4. **Account linking** (allow users to link Google to existing email/password account)

---

## ✅ **Testing Checklist**

- [ ] Google OAuth enabled in Supabase
- [ ] Google credentials configured correctly
- [ ] Login with Google works
- [ ] Signup with Google works
- [ ] Profile created with `full_name` and `avatar_url`
- [ ] `email_verified` is `true` for Google users
- [ ] No "Sign In Required" flash after login
- [ ] User can access dashboard after Google login
- [ ] User role is `free` by default

---

**Last Updated**: 2025-11-13  
**Status**: Ready to enable - code is complete!

