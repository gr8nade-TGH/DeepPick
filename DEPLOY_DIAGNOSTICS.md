# 🚀 Deploy SHIVA Diagnostics - Quick Checklist

## Files to Deploy

### New Files Created
- ✅ `src/app/debug/shiva/page.tsx` - Diagnostic dashboard
- ✅ `src/app/api/debug/shiva-diagnostics/route.ts` - System diagnostics API
- ✅ `src/app/api/debug/database-state/route.ts` - Database state API
- ✅ `src/app/api/debug/trigger-shiva/route.ts` - Manual cron trigger
- ✅ `VERIFY_DATABASE_SETUP.sql` - Database verification queries
- ✅ `DIAGNOSTICS_GUIDE.md` - Troubleshooting guide
- ✅ `SHIVA_DIAGNOSTICS_SUMMARY.md` - Implementation summary
- ✅ `DEPLOY_DIAGNOSTICS.md` - This file

---

## Deployment Steps

### 1. Commit and Push
```bash
git add .
git commit -m "Add SHIVA diagnostic tools to troubleshoot empty dashboard tables"
git push origin main
```

### 2. Wait for Vercel Deployment
- Go to https://vercel.com/dashboard
- Wait for deployment to complete (~2 minutes)
- Look for green checkmark

### 3. Test the Diagnostic Dashboard
```bash
# Open in browser
https://deep-pick.vercel.app/debug/shiva
```

### 4. Run Diagnostics
1. Click "Run Full Diagnostics"
2. Click "Check Database State"
3. Read the diagnosis

### 5. Identify the Issue
Look for:
- 🚨 Critical issues (red)
- ⚠️ Warnings (yellow)
- ℹ️ Info (blue)

### 6. Apply the Fix
Most likely fixes:

**If "NO ACTIVE NBA GAMES":**
```bash
# Check if odds ingestion is running
curl https://deep-pick.vercel.app/api/cron/sync-mysportsfeeds-odds

# Verify MYSPORTSFEEDS_API_KEY is set in Vercel
# Go to Vercel → Settings → Environment Variables
```

**If "STALE LOCK DETECTED":**
```sql
-- Run in Supabase SQL Editor
DELETE FROM system_locks WHERE lock_key = 'shiva_auto_picks_lock';
```

**If "ALL GAMES IN COOLDOWN":**
```sql
-- Run in Supabase SQL Editor (for testing only)
DELETE FROM pick_generation_cooldowns WHERE capper = 'shiva';
```

### 7. Verify the Fix
```bash
# Check management dashboard
https://deep-pick.vercel.app/cappers/shiva/management

# Should now see:
# - Run Log table populated
# - Cooldown table populated
```

---

## Testing Checklist

### ✅ Pre-Deployment
- [x] All files created
- [x] No syntax errors
- [x] TypeScript compiles

### ✅ Post-Deployment
- [ ] Diagnostic dashboard loads
- [ ] "Run Full Diagnostics" button works
- [ ] "Check Database State" button works
- [ ] "Trigger Cron Manually" button works
- [ ] Health status displays correctly
- [ ] Issues are categorized (critical/warning/info)

### ✅ After Fix Applied
- [ ] Run Log table shows data
- [ ] Cooldown table shows data
- [ ] New runs appear every 10 minutes
- [ ] Cooldowns update in real-time

---

## Rollback Plan

If something goes wrong:

```bash
# Revert the commit
git revert HEAD
git push origin main

# OR delete the diagnostic files
rm -rf src/app/debug/shiva
rm -rf src/app/api/debug/shiva-diagnostics
rm -rf src/app/api/debug/database-state
rm -rf src/app/api/debug/trigger-shiva
git add .
git commit -m "Remove diagnostic tools"
git push origin main
```

---

## Support

If you encounter issues:

1. **Check Vercel Logs:**
   - Vercel Dashboard → Deployments → Latest → Functions
   - Look for errors in `/api/debug/*` endpoints

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for JavaScript errors

3. **Check Supabase Logs:**
   - Supabase Dashboard → Logs
   - Filter by "shiva" or "diagnostic"

4. **Manual API Testing:**
   ```bash
   # Test each endpoint individually
   curl https://deep-pick.vercel.app/api/debug/shiva-diagnostics
   curl https://deep-pick.vercel.app/api/debug/database-state
   curl https://deep-pick.vercel.app/api/debug/trigger-shiva
   ```

---

## Expected Timeline

- **Deployment:** 2 minutes
- **Running diagnostics:** 30 seconds
- **Identifying issue:** 1 minute
- **Applying fix:** 5 minutes
- **Verification:** 10 minutes (wait for next cron run)

**Total:** ~20 minutes from deployment to verified fix

---

## Success Criteria

✅ Diagnostic dashboard is accessible  
✅ All diagnostic checks run without errors  
✅ Root cause is identified  
✅ Fix is applied  
✅ Run Log table shows data  
✅ Cooldown table shows data  
✅ New runs appear every 10 minutes  

---

**Ready to deploy!** 🚀

