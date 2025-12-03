# Sharp Siege - Backup & Recovery Strategy

**Last Updated:** 2025-11-29
**Purpose:** Full backup strategy for recovering from catastrophic failures

---

## 🎯 Backup Philosophy

**Git Tags = Lightweight Checkpoints** (Current System)
- ✅ Fast to create (instant)
- ✅ No storage overhead (just a pointer)
- ✅ Easy to recover (`git checkout <tag>`)
- ❌ Requires git history intact
- ❌ Lost if `.git` folder corrupted

**Full Backups = Complete Safety Net** (Recommended Addition)
- ✅ Survives git corruption
- ✅ Survives accidental force-push
- ✅ Can restore entire project from scratch
- ❌ Takes more time/storage

---

## 📦 Recommended Backup Strategy (3-Tier System)

### Tier 1: Git Tags (Current - Keep Using)
**Frequency:** Before major changes
**Purpose:** Quick checkpoints for normal development
**Recovery Time:** Instant

```bash
# Create checkpoint
git tag -a v1.1-feature-name -m "Description"
git push origin v1.1-feature-name

# Recover
git checkout v1.1-feature-name
```

### Tier 2: GitHub Remote (Automatic)
**Frequency:** Every push
**Purpose:** Cloud backup of git history
**Recovery Time:** Minutes

```bash
# Already happening automatically when you push
git push origin main

# Recover entire repo
git clone https://github.com/gr8nade-TGH/DeepPick.git
```

### Tier 3: Full Project Backup (NEW - Recommended)
**Frequency:** Weekly or before risky changes
**Purpose:** Complete safety net (includes node_modules, .env, etc.)
**Recovery Time:** 5-10 minutes

---

## 🔧 Tier 3: Full Backup Implementation

### Option A: Manual ZIP Backup (Simplest)

**Create Backup:**
```powershell
# Run from project root
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupName = "DeepPick_Backup_$timestamp.zip"
$backupPath = "C:\Users\Tucke\Documents\DeepPick_Backups\$backupName"

# Create backup directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "C:\Users\Tucke\Documents\DeepPick_Backups"

# Create ZIP (excludes node_modules to save space)
Compress-Archive -Path "C:\Users\Tucke\OneDrive\Desktop\DeepPick App\*" `
                 -DestinationPath $backupPath `
                 -Force

Write-Output "✅ Backup created: $backupPath"
```

**Restore Backup:**
```powershell
# Extract to new location
Expand-Archive -Path "C:\Users\Tucke\Documents\DeepPick_Backups\DeepPick_Backup_2025-11-29_1430.zip" `
               -DestinationPath "C:\Users\Tucke\Desktop\DeepPick_Restored"

# Reinstall dependencies
cd "C:\Users\Tucke\Desktop\DeepPick_Restored"
npm install
```

### Option B: Automated Script (Recommended)

**Create:** `scripts/create-backup.ps1`
```powershell
# See implementation below
```

---

## 🚀 Quick Backup Commands

**I'll create these for you:**

1. **`npm run backup`** - Creates full ZIP backup
2. **`npm run backup:list`** - Lists all backups
3. **`npm run backup:restore`** - Interactive restore

---

## 📊 Backup Schedule Recommendation

| Scenario | Backup Type | Command |
|----------|-------------|---------|
| **Before major feature** | Git Tag | `git tag -a v1.x-name -m "msg"` |
| **End of day** | Git Push | `git push origin main` |
| **Before risky changes** | Full Backup | `npm run backup` |
| **Weekly** | Full Backup | `npm run backup` |
| **Before agent handoff** | Git Tag + Full Backup | Both |

---

## 🎯 Recovery Scenarios

### Scenario 1: "I broke something in the last hour"
**Solution:** Git tag checkpoint
```bash
git checkout v1.x-last-working
```

### Scenario 2: "I accidentally deleted files"
**Solution:** Git restore
```bash
git restore .
```

### Scenario 3: "Git is corrupted / .git folder deleted"
**Solution:** Full backup restore
```powershell
# Extract latest backup
# Reinstall dependencies
```

### Scenario 4: "Everything is broken, start over"
**Solution:** Clone from GitHub
```bash
git clone https://github.com/gr8nade-TGH/DeepPick.git
npm install
```

---

## 💾 Storage Estimates

**Git Tags:** ~0 bytes (just pointers)
**GitHub Remote:** ~500 MB (full repo)
**Full Backup (with node_modules):** ~2 GB per backup
**Full Backup (without node_modules):** ~50 MB per backup

**Recommendation:** Exclude `node_modules` from backups (can reinstall with `npm install`)

---

## ✅ Next Steps

1. **Create backup script** (I'll do this for you)
2. **Test backup/restore** (verify it works)
3. **Set reminder** (weekly backups)
4. **Document in brain** (so new agents know)

