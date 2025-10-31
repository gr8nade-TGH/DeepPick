# 🚀 Quick Setup Guide - Augment Auto-Backup System

**Time Required:** 5 minutes  
**Difficulty:** Easy

---

## ✅ What You're Setting Up

An automatic backup system that:
- ✅ Backs up your Augment AI conversations **every day at 2:00 AM**
- ✅ Saves backups to **OneDrive** (so they're safe even if your computer crashes)
- ✅ Keeps **30 days** of backup history
- ✅ Automatically **deletes old backups** to save space
- ✅ Lets you **restore conversations** anytime

---

## 📝 Step-by-Step Setup

### Step 1: Open PowerShell as Administrator

1. Press `Windows Key`
2. Type `PowerShell`
3. **Right-click** on "Windows PowerShell"
4. Click **"Run as Administrator"**
5. Click **"Yes"** when prompted

### Step 2: Navigate to the Scripts

In PowerShell, type:

```powershell
cd "C:\Users\Tucke\OneDrive\Desktop\DeepPick App"
```

Press `Enter`

### Step 3: Run the Setup Script

Type this command:

```powershell
.\Setup-Augment-Backup-Schedule.ps1
```

Press `Enter`

### Step 4: Follow the Prompts

The script will:
1. Check if a backup task already exists
2. Create a new scheduled task
3. Ask if you want to run a test backup

**When asked "Would you like to run a test backup now?"**
- Type `Y` and press `Enter`

### Step 5: Done! 🎉

You should see:
```
SUCCESS! Scheduled task created!
```

Your backups are now running automatically!

---

## 🔍 Verify It's Working

### Check the Scheduled Task

```powershell
Get-ScheduledTask -TaskName "Augment-Conversation-Backup"
```

You should see:
- **State:** Ready
- **Next Run Time:** Tomorrow at 2:00 AM

### Check the Backup Folder

```powershell
explorer "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations"
```

You should see folders with your workspace IDs and timestamps.

---

## 🎯 What Happens Next?

### Automatic Backups

Every day at **2:00 AM**, the backup script will:
1. Find all Augment workspaces
2. Copy conversation data to OneDrive
3. Create a timestamped backup
4. Delete backups older than 30 days
5. Log everything to a file

### You Don't Need to Do Anything!

The system runs automatically. Just check occasionally that:
- OneDrive is syncing
- Backups are being created
- No errors in the logs

---

## 📊 How to Check Backups

### View All Backups

```powershell
.\Restore-Augment-Backup.ps1 -ListBackups
```

### View Recent Logs

```powershell
notepad "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs\backup-$(Get-Date -Format 'yyyy-MM').log"
```

---

## 🔄 How to Restore a Backup

If you ever lose your conversations:

### Option 1: Interactive Restore (Easiest)

```powershell
.\Restore-Augment-Backup.ps1
```

Follow the prompts to select which backup to restore.

### Option 2: Quick Restore Latest

```powershell
.\Restore-Augment-Backup.ps1 -Force
```

This restores the most recent backup without asking questions.

---

## ⚙️ Customization Options

### Change Backup Time

Want backups at a different time? Re-run setup with parameters:

```powershell
# Backup at 3:00 AM instead
.\Setup-Augment-Backup-Schedule.ps1 -Hour 3 -Minute 0

# Backup at 2:30 PM
.\Setup-Augment-Backup-Schedule.ps1 -Hour 14 -Minute 30
```

### Change to Hourly Backups

```powershell
.\Setup-Augment-Backup-Schedule.ps1 -Frequency Hourly
```

### Change to Weekly Backups

```powershell
.\Setup-Augment-Backup-Schedule.ps1 -Frequency Weekly
```

---

## 🛠️ Manual Backup (Anytime)

Want to create a backup right now?

```powershell
.\Augment-Auto-Backup.ps1 -Force
```

**Note:** Close VS Code first, or the backup may fail due to locked files.

---

## ⚠️ Important Notes

### VS Code Must Be Closed

The backup works best when VS Code is closed. That's why it runs at 2:00 AM (when you're probably not using it).

If VS Code is running:
- The script will retry 3 times
- If still locked, it will skip that workspace
- It will try again on the next scheduled run

### OneDrive Must Be Running

Make sure OneDrive is:
- ✅ Running and syncing
- ✅ Not paused
- ✅ Has enough space (backups are usually < 5 MB each)

### Backups Are Local First

Backups are created on your computer first, then OneDrive syncs them to the cloud. This means:
- Backups work even if OneDrive is temporarily offline
- OneDrive will sync them when it reconnects

---

## 🐛 Troubleshooting

### "Execution Policy" Error

If you see an error about execution policy, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try the setup again.

### "Access Denied" Error

Make sure you're running PowerShell **as Administrator**.

### Backup Not Running

1. Check if the task exists:
   ```powershell
   Get-ScheduledTask -TaskName "Augment-Conversation-Backup"
   ```

2. Check the logs:
   ```powershell
   notepad "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs\backup-$(Get-Date -Format 'yyyy-MM').log"
   ```

3. Run manually to see errors:
   ```powershell
   .\Augment-Auto-Backup.ps1 -Force
   ```

### OneDrive Not Syncing

1. Check OneDrive status (system tray icon)
2. Make sure you have enough space
3. Try pausing and resuming sync
4. Check if the backup folder is excluded from sync

---

## 📚 More Information

For detailed documentation, see:
- **`BACKUP_SYSTEM_README.md`** - Complete guide with all features
- **Logs folder** - `C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs`

---

## 🎉 You're All Set!

Your Augment conversations are now automatically backed up every day!

**What you get:**
- ✅ Peace of mind - never lose conversations again
- ✅ Automatic backups - no manual work required
- ✅ 30 days of history - restore from any day
- ✅ OneDrive sync - safe even if computer crashes
- ✅ Easy restore - one command to get conversations back

**Enjoy!** 🚀

