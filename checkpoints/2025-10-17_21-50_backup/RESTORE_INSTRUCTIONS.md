# 🔄 RESTORE INSTRUCTIONS

## Quick Restore from Checkpoint

**Checkpoint:** 2025-10-17_21-50_PICKS_SYSTEM_COMPLETE  
**Git Commit:** b4e4e9a

---

## Method 1: Git Restore (Recommended)

```bash
# Navigate to project
cd "C:\Users\Tucke\OneDrive\Desktop\DeepPick App"

# Checkout this specific commit
git checkout b4e4e9a

# Create a new branch if you want to preserve current work
git checkout -b restore-from-checkpoint

# Reinstall dependencies
npm install

# Push to deploy
git push origin main
```

---

## Method 2: Manual File Restore

If git history is lost, restore from this backup folder:

### 1. Copy Files Back:
```powershell
# From this backup directory, copy back to project root
Copy-Item -Path ".\src" -Destination "..\..\src" -Recurse -Force
Copy-Item -Path ".\supabase" -Destination "..\..\supabase" -Recurse -Force
Copy-Item -Path ".\package.json",".\package-lock.json",".\next.config.js",".\tsconfig.json",".\tailwind.config.ts",".\.env.example" -Destination "..\.." -Force
```

### 2. Reinstall Dependencies:
```bash
npm install
```

### 3. Restore Database:

**Run these migrations in Supabase SQL Editor (in order):**

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_odds_history.sql`
3. `supabase/migrations/003_games_history.sql`
4. `supabase/migrations/004_picks_system_clean.sql`
5. `supabase/migrations/005_fix_picks_cascade.sql`

### 4. Environment Variables:

Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=https://xckbsyeaywrfzvcahhtk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
THE_ODDS_API_KEY=cf8793803e24a2a3d7c75f85f3c2198d
```

Also set in Vercel dashboard.

### 5. Deploy:
```bash
git add -A
git commit -m "Restore from checkpoint 2025-10-17_21-50"
git push origin main
```

---

## Verification Checklist

After restore, verify:

- [ ] Dashboard loads at `/`
- [ ] Live Odds page works at `/odds`
- [ ] History page works at `/history`
- [ ] Can place test pick at `/test-pick`
- [ ] Picks table exists in Supabase
- [ ] All 5 migrations applied
- [ ] Environment variables set
- [ ] No console errors

---

## What You'll Have After Restore

✅ Full picks system with auto-grading  
✅ Live odds dashboard with charts  
✅ Game history and archival  
✅ Performance metrics  
✅ Score fetching  
✅ All UI enhancements  

See `CHECKPOINT_2025-10-17_21-50_PICKS_SYSTEM_COMPLETE.md` for full feature list.

---

## Troubleshooting

### Issue: "picks table doesn't exist"
**Solution:** Run migrations 004 and 005 in Supabase

### Issue: "500 error on /api/picks"
**Solution:** Check SUPABASE_SERVICE_ROLE_KEY is set in Vercel

### Issue: "No games showing"
**Solution:** Click "Ingest Fresh Odds" button on `/odds` page

### Issue: "Picks not grading"
**Solution:** Run `/api/fetch-scores` to fetch final scores

---

**END OF RESTORE INSTRUCTIONS**

