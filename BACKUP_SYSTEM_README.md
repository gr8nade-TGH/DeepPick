# 🔐 Augment AI Automatic Backup System

**Created:** October 30, 2025  
**Purpose:** Automatically backup Augment AI conversations to OneDrive (since Augment has no cloud sync)

---

## 📦 What's Included

This backup system consists of 3 PowerShell scripts:

1. **`Augment-Auto-Backup.ps1`** - Main backup script (runs automatically)
2. **`Setup-Augment-Backup-Schedule.ps1`** - One-time setup to schedule automatic backups
3. **`Restore-Augment-Backup.ps1`** - Restore conversations from backup when needed

---

## 🚀 Quick Start (First Time Setup)

### Step 1: Run the Setup Script

Open PowerShell **as Administrator** and run:

```powershell
cd "C:\Users\Tucke\OneDrive\Desktop\DeepPick App"
.\Setup-Augment-Backup-Schedule.ps1
```

**Options:**
- Default: Daily backups at 2:00 AM
- Custom time: `.\Setup-Augment-Backup-Schedule.ps1 -Hour 14 -Minute 30` (2:30 PM)
- Hourly: `.\Setup-Augment-Backup-Schedule.ps1 -Frequency Hourly`
- Weekly: `.\Setup-Augment-Backup-Schedule.ps1 -Frequency Weekly`

### Step 2: Test It

The setup script will ask if you want to run a test backup. Say **Yes** to verify it works!

### Step 3: Done! ✅

Your backups will now run automatically. You don't need to do anything else!

---

## 📁 Where Are Backups Stored?

```
C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\
├── [workspace-id-1]\
│   ├── 2025-10-30_140000\
│   ├── 2025-10-31_140000\
│   └── 2025-11-01_140000\
├── [workspace-id-2]\
│   └── 2025-10-30_140000\
└── Logs\
    ├── backup-2025-10.log
    └── backup-2025-11.log
```

**Backup Structure:**
- Each workspace gets its own folder
- Each backup is timestamped (YYYY-MM-DD_HHMMSS)
- Logs are organized by month
- Old backups (>30 days) are automatically deleted

---

## 🔄 How to Restore a Backup

### Option 1: Interactive Restore (Recommended)

```powershell
.\Restore-Augment-Backup.ps1
```

The script will:
1. Show you all available backups
2. Let you select which one to restore
3. Safely backup existing data before restoring
4. Restore the selected backup

### Option 2: List All Backups

```powershell
.\Restore-Augment-Backup.ps1 -ListBackups
```

### Option 3: Restore Specific Backup

```powershell
# Restore specific workspace
.\Restore-Augment-Backup.ps1 -WorkspaceId "b6d0b1861833f9c59d1fb4575d5b9234"

# Restore specific date
.\Restore-Augment-Backup.ps1 -BackupDate "2025-10-30"

# Force restore without confirmation
.\Restore-Augment-Backup.ps1 -Force
```

---

## 🛠️ Manual Backup (Anytime)

Want to create a backup right now? Just run:

```powershell
.\Augment-Auto-Backup.ps1
```

**Options:**
- Force backup even if one exists today: `.\Augment-Auto-Backup.ps1 -Force`
- Silent mode (no console output): `.\Augment-Auto-Backup.ps1 -Silent`

---

## 📊 Check Backup Status

### View Scheduled Task

```powershell
Get-ScheduledTask -TaskName "Augment-Conversation-Backup"
```

### View Recent Backups

```powershell
Get-ChildItem "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations" -Recurse -Directory | 
    Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' } | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object Name, LastWriteTime, @{Name='Size';Expression={(Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB}} -First 10
```

### View Logs

```powershell
Get-Content "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs\backup-$(Get-Date -Format 'yyyy-MM').log" -Tail 50
```

---

## ⚙️ Configuration

### Change Backup Schedule

Re-run the setup script with different parameters:

```powershell
# Change to 3:00 AM daily
.\Setup-Augment-Backup-Schedule.ps1 -Hour 3 -Minute 0

# Change to hourly
.\Setup-Augment-Backup-Schedule.ps1 -Frequency Hourly
```

### Change Retention Period

Edit `Augment-Auto-Backup.ps1` and change this line:

```powershell
RetentionDays = 30  # Change to 60, 90, etc.
```

### Change Backup Location

Edit `Augment-Auto-Backup.ps1` and change this line:

```powershell
BackupRoot = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations"
```

**Note:** If you change the location, also update `Restore-Augment-Backup.ps1`

---

## 🔔 Notifications

### Check if Backup Ran

Look at the log file:

```powershell
notepad "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs\backup-$(Get-Date -Format 'yyyy-MM').log"
```

### Add Email Notifications (Optional)

Edit `Augment-Auto-Backup.ps1` and add to the `Send-BackupNotification` function:

```powershell
# Example: Send email via Gmail
$emailParams = @{
    From = "your-email@gmail.com"
    To = "your-email@gmail.com"
    Subject = "Augment Backup: $status"
    Body = $message
    SmtpServer = "smtp.gmail.com"
    Port = 587
    UseSsl = $true
    Credential = (Get-Credential)
}
Send-MailMessage @emailParams
```

---

## 🐛 Troubleshooting

### Backup Not Running Automatically

1. **Check if task exists:**
   ```powershell
   Get-ScheduledTask -TaskName "Augment-Conversation-Backup"
   ```

2. **Check task history:**
   - Open Task Scheduler (`taskschd.msc`)
   - Find "Augment-Conversation-Backup"
   - Click "History" tab

3. **Run manually to test:**
   ```powershell
   .\Augment-Auto-Backup.ps1
   ```

### Backup Says "No Workspaces Found"

This means Augment hasn't created any workspace data yet. This is normal if:
- You just installed Augment
- You haven't had any conversations yet
- You recently cleared all workspace storage

### Restore Not Working

1. **Check if backups exist:**
   ```powershell
   .\Restore-Augment-Backup.ps1 -ListBackups
   ```

2. **Make sure VS Code is closed** before restoring

3. **Check permissions** - make sure you can write to the workspace storage folder

### OneDrive Sync Issues

If OneDrive is slow or not syncing:

1. **Pause OneDrive sync** during backup/restore
2. **Change backup location** to a local drive (not OneDrive)
3. **Manually copy backups** to OneDrive later

---

## 📋 What Gets Backed Up?

The backup includes:
- ✅ **Conversation history** (all your chats with Augment)
- ✅ **Augment memories** (things Augment remembers about you)
- ✅ **User assets** (checkpoints, documents)
- ✅ **Global state** (settings, preferences)
- ✅ **Key-value store** (LevelDB database with all data)

The backup does NOT include:
- ❌ VS Code settings (those are backed up separately by VS Code)
- ❌ Your actual project files (only Augment data)
- ❌ Augment extension itself (just the data)

---

## 🔒 Security & Privacy

### Is My Data Safe?

- ✅ Backups are stored **locally on your OneDrive**
- ✅ No data is sent to any third-party servers
- ✅ Only you have access to the backups
- ✅ Backups are in the same format Augment uses (LevelDB)

### Can I Encrypt Backups?

Yes! OneDrive supports encryption. You can:
1. Use **Windows BitLocker** to encrypt your entire drive
2. Use **OneDrive Personal Vault** for extra security
3. Use **7-Zip with password** to compress and encrypt backups

---

## 📈 Advanced Usage

### Backup Multiple Machines

If you use Augment on multiple computers:

1. **Set up the backup system on each machine**
2. **Use different OneDrive folders** for each machine:
   ```powershell
   BackupRoot = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations-Desktop"
   BackupRoot = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations-Laptop"
   ```
3. **Restore from any machine** when needed

### Backup to External Drive

Change the backup location to an external drive:

```powershell
BackupRoot = "E:\Backups\Augment-Conversations"
```

### Backup Before Clearing Cache

Before clearing VS Code workspace cache, run:

```powershell
.\Augment-Auto-Backup.ps1 -Force
```

This ensures you have a fresh backup before deleting anything.

---

## 🎯 Best Practices

1. ✅ **Test the restore process** at least once to make sure it works
2. ✅ **Check logs monthly** to ensure backups are running
3. ✅ **Keep at least 30 days** of backups (default setting)
4. ✅ **Run manual backup** before major VS Code updates
5. ✅ **Verify OneDrive is syncing** your backup folder
6. ✅ **Don't delete backups manually** - let the script manage retention

---

## 🆘 Emergency Recovery

If you lose all your conversations:

1. **Check OneDrive** - backups should be there
2. **Run restore script:**
   ```powershell
   .\Restore-Augment-Backup.ps1 -ListBackups
   ```
3. **Select the most recent backup** and restore
4. **Restart VS Code**
5. **Open Augment** - conversations should be back!

If backups are missing:
1. Check OneDrive recycle bin
2. Check Windows File History (if enabled)
3. Use the recovery script from earlier: `recover-augment-conversations.ps1`

---

## 📞 Support

If you need help:
1. Check the logs first
2. Run manual backup to see error messages
3. Ask me (Augment AI) for help! 😊

---

## 🎉 You're All Set!

Your Augment conversations are now automatically backed up to OneDrive every day. You'll never lose your chat history again! 🚀

**Remember:**
- Backups run automatically (you don't need to do anything)
- Old backups are cleaned up automatically (>30 days)
- You can restore anytime with the restore script
- Check logs occasionally to make sure everything is working

Enjoy your peace of mind! 😌

