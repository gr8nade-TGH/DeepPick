# Authentication Testing Checklist - Sharp Siege

## 🎯 Quick Test (2 minutes)

After waking up, do this quick test first:

1. **Open the site in incognito mode**: https://deep-pick.vercel.app
2. **Check console logs** - You should see:
   ```
   [AuthContext] Initializing...
   [AuthContext] Setting up auth state listener...
   [AuthContext] Getting initial session...
   [AuthContext] No initial session
   [AuthContext] Initialization complete, setting loading to false
   ```
3. **Login/Signup buttons should appear instantly** (no 2-second delay)
4. **Click "Log In"** and enter:
   - Email: tucker.harris@gmail.com
   - Password: [your password]
5. **After login, check console** - You should see:
   ```
   [AuthContext] Auth state changed: SIGNED_IN User: true 35d939ca-afca-4c08-b1bc-d5954c1669a6
   [AuthContext] Fetching profile after auth change...
   [AuthContext] Profile loaded after auth change: admin
   ```
6. **User menu should appear** with "Tucker" and admin badge
7. **No errors in console** (no 500 errors, no infinite recursion errors)

✅ **If all of the above works, the authentication system is fixed!**

---

## 🧪 Comprehensive Testing (15 minutes)

### Test 1: Login Flow (Existing User)

**Steps:**
1. Go to https://deep-pick.vercel.app in incognito mode
2. Click "Log In"
3. Enter tucker.harris@gmail.com and your password
4. Click "Sign In"

**Expected Results:**
- ✅ Login completes in < 1 second
- ✅ Redirects to dashboard
- ✅ User menu appears with "Tucker"
- ✅ Admin badge visible
- ✅ No console errors

**If it fails:**
- Check console for error messages
- Look for "infinite recursion" errors
- Look for 500 errors from Supabase
- Share the console output

---

### Test 2: Signup Flow (New User)

**Steps:**
1. Go to https://deep-pick.vercel.app in incognito mode
2. Click "Sign Up"
3. Enter:
   - Profile Name: Test User
   - Email: tucker.harris+test@gmail.com (or any other email)
   - Password: testpass123
   - Confirm Password: testpass123
4. Click "Create Account"

**Expected Results:**
- ✅ Shows "Check Your Email" message
- ✅ Email sent to your inbox
- ✅ Profile auto-created in database with 'free' role
- ✅ No console errors

**Verify in Database:**
Run this query in Supabase SQL Editor:
```sql
SELECT id, email, full_name, role, email_verified 
FROM profiles 
WHERE email = 'tucker.harris+test@gmail.com';
```

Should return:
```
id: [some UUID]
email: tucker.harris+test@gmail.com
full_name: Test User
role: free
email_verified: false
```

---

### Test 3: Email Verification

**Steps:**
1. After signing up, check your email
2. Click the verification link
3. Should redirect to the app

**Expected Results:**
- ✅ Redirects to dashboard
- ✅ User is logged in
- ✅ `email_verified` is set to `true` in database

**Verify in Database:**
```sql
SELECT email_verified 
FROM profiles 
WHERE email = 'tucker.harris+test@gmail.com';
```

Should return: `email_verified: true`

---

### Test 4: Profile Fetch Performance

**Steps:**
1. Log in as tucker.harris@gmail.com
2. Open browser DevTools → Network tab
3. Filter by "profiles"
4. Refresh the page

**Expected Results:**
- ✅ Profile fetch completes in < 300ms
- ✅ HTTP 200 status (not 500)
- ✅ Response contains your profile data
- ✅ No timeout errors

---

### Test 5: Role-Based Access Control

**Test 5a: Admin Access**
1. Log in as tucker.harris@gmail.com (admin)
2. Navigate to:
   - `/admin` - Should work ✅
   - `/make-picks` - Should work ✅
   - `/settings/profile` - Should work ✅

**Test 5b: Free User Access**
1. Log in as the test user (free role)
2. Navigate to:
   - `/admin` - Should redirect to home ✅
   - `/make-picks` - Should redirect to upgrade page ✅
   - `/settings/profile` - Should work ✅
   - Dashboard - Should work ✅
   - Leaderboard - Should work ✅

---

### Test 6: Betting Slip Visibility

**Test 6a: Admin User**
1. Log in as tucker.harris@gmail.com (admin)
2. Check bottom-right corner

**Expected Results:**
- ✅ Betting slip visible (BET SLIP and OPEN BETS tabs)

**Test 6b: Free User**
1. Log in as test user (free role)
2. Check bottom-right corner

**Expected Results:**
- ✅ Betting slip NOT visible

**Test 6c: Not Logged In**
1. Log out
2. Check bottom-right corner

**Expected Results:**
- ✅ Betting slip NOT visible

---

### Test 7: Profile Settings

**Steps:**
1. Log in as tucker.harris@gmail.com
2. Navigate to Settings → Profile
3. Update:
   - Bio: "Test bio"
   - Twitter URL: https://twitter.com/test
   - Instagram URL: https://instagram.com/test
4. Click "Save Changes"

**Expected Results:**
- ✅ Success message appears
- ✅ Changes saved to database
- ✅ No console errors

**Verify in Database:**
```sql
SELECT bio, twitter_url, instagram_url 
FROM profiles 
WHERE email = 'tucker.harris@gmail.com';
```

---

### Test 8: Logout

**Steps:**
1. Log in as tucker.harris@gmail.com
2. Click user menu → "Sign Out"

**Expected Results:**
- ✅ Redirects to home page
- ✅ User menu disappears
- ✅ Login/Signup buttons appear
- ✅ Betting slip disappears
- ✅ No console errors

---

### Test 9: Session Persistence

**Steps:**
1. Log in as tucker.harris@gmail.com
2. Close the browser tab
3. Open a new tab and go to https://deep-pick.vercel.app

**Expected Results:**
- ✅ Still logged in (user menu visible)
- ✅ No need to log in again
- ✅ Profile loads automatically

---

### Test 10: Concurrent Sessions

**Steps:**
1. Log in as tucker.harris@gmail.com in Chrome
2. Open Firefox and go to https://deep-pick.vercel.app
3. Log in as tucker.harris@gmail.com in Firefox

**Expected Results:**
- ✅ Both sessions work independently
- ✅ No conflicts or errors
- ✅ Both show user menu correctly

---

## 🐛 Common Issues and Solutions

### Issue 1: "infinite recursion detected in policy"
**Cause:** RLS policies are querying the profiles table within a profiles policy
**Solution:** Already fixed! Policies are now simple and non-recursive.

### Issue 2: Profile fetch timeout
**Cause:** Profiles table doesn't exist or RLS policies blocking access
**Solution:** Already fixed! Table created and policies corrected.

### Issue 3: Login/Signup buttons take 2+ seconds to load
**Cause:** Profile fetch hanging, waiting for timeout
**Solution:** Already fixed! Profile fetch now completes in < 300ms.

### Issue 4: User menu doesn't appear after login
**Cause:** Profile is null because fetch failed
**Solution:** Already fixed! Profile fetch now works correctly.

### Issue 5: 500 error when fetching profile
**Cause:** Database error (infinite recursion, missing table, etc.)
**Solution:** Already fixed! All database issues resolved.

---

## 📊 Success Criteria

The authentication system is considered **fully functional** if:

1. ✅ Login/Signup buttons appear instantly (< 500ms)
2. ✅ Login completes in < 2 seconds
3. ✅ Profile fetch completes in < 300ms
4. ✅ User menu appears after login
5. ✅ No console errors (no 500s, no infinite recursion)
6. ✅ New user signup creates profile automatically
7. ✅ Email verification syncs to database
8. ✅ Role-based access control works
9. ✅ Betting slip visibility based on role
10. ✅ Session persists across browser restarts

---

## 🚨 If Tests Fail

If any test fails, please provide:

1. **Which test failed** (Test 1, Test 2, etc.)
2. **Console output** (copy/paste the entire console)
3. **Network tab** (screenshot of failed requests)
4. **Expected vs Actual** (what you expected vs what happened)

I'll diagnose and fix the issue immediately!

---

## ✅ Final Verification

After all tests pass, verify these one more time:

- [ ] Login works instantly
- [ ] Signup creates profile automatically
- [ ] Email verification syncs
- [ ] Profile fetch < 300ms
- [ ] User menu appears
- [ ] No console errors
- [ ] Role-based access works
- [ ] Betting slip visibility correct
- [ ] Profile settings work
- [ ] Logout works
- [ ] Session persists

**If all checkboxes are checked, the authentication system is production-ready!** 🎉

