# ============================================================================
# Augment AI Conversation Auto-Backup Script
# ============================================================================
# This script automatically backs up your Augment AI conversations to OneDrive
# Keeps the last 30 days of backups and provides detailed logging
# ============================================================================

param(
    [switch]$Silent = $false,  # Run without user interaction
    [switch]$Force = $false     # Force backup even if no changes detected
)

# Configuration
$config = @{
    SourcePath      = "C:\Users\Tucke\AppData\Roaming\Code\User\workspaceStorage"
    BackupRoot      = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations"
    LogPath         = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs"
    RetentionDays   = 30
    MinBackupSizeMB = 0.01  # Minimum size to consider a valid backup
}

# ============================================================================
# Functions
# ============================================================================

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"  # INFO, SUCCESS, WARNING, ERROR
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Create log directory if it doesn't exist
    if (-not (Test-Path $config.LogPath)) {
        New-Item -ItemType Directory -Path $config.LogPath -Force | Out-Null
    }
    
    # Write to log file
    $logFile = Join-Path $config.LogPath "backup-$(Get-Date -Format 'yyyy-MM').log"
    Add-Content -Path $logFile -Value $logMessage
    
    # Write to console if not silent
    if (-not $Silent) {
        switch ($Level) {
            "SUCCESS" { Write-Host $Message -ForegroundColor Green }
            "WARNING" { Write-Host $Message -ForegroundColor Yellow }
            "ERROR" { Write-Host $Message -ForegroundColor Red }
            default { Write-Host $Message -ForegroundColor White }
        }
    }
}

function Get-AugmentWorkspaces {
    Write-Log "Scanning for Augment workspaces..."
    
    if (-not (Test-Path $config.SourcePath)) {
        Write-Log "Source path does not exist: $($config.SourcePath)" "ERROR"
        return @()
    }
    
    $workspaces = Get-ChildItem -Path $config.SourcePath -Directory | 
    Where-Object { 
        Test-Path (Join-Path $_.FullName "Augment.vscode-augment")
    }
    
    Write-Log "Found $($workspaces.Count) workspace(s) with Augment data" "SUCCESS"
    return $workspaces
}

function Get-BackupSize {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        return 0
    }
    
    $size = (Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue | 
        Measure-Object -Property Length -Sum).Sum
    
    return [math]::Round($size / 1MB, 2)
}

function Test-BackupNeeded {
    param([string]$BackupPath)
    
    if ($Force) {
        Write-Log "Force flag set - backup will proceed" "INFO"
        return $true
    }
    
    if (-not (Test-Path $BackupPath)) {
        Write-Log "No previous backup found - backup needed" "INFO"
        return $true
    }
    
    # Check if backup is from today
    $latestBackup = Get-ChildItem -Path $BackupPath -Directory | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 1
    
    if ($latestBackup) {
        $backupDate = $latestBackup.LastWriteTime.Date
        $today = (Get-Date).Date
        
        if ($backupDate -eq $today) {
            Write-Log "Backup already exists for today - skipping" "INFO"
            return $false
        }
    }
    
    return $true
}

function Backup-AugmentData {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.DirectoryInfo]$Workspace
    )
    
    $workspaceId = $Workspace.Name
    $sourcePath = Join-Path $Workspace.FullName "Augment.vscode-augment"
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $backupPath = Join-Path $config.BackupRoot "$workspaceId\$timestamp"
    
    Write-Log "Backing up workspace: $workspaceId" "INFO"
    
    try {
        # Create backup directory
        New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

        # Copy Augment data with retry logic for locked files
        $maxRetries = 3
        $retryCount = 0
        $success = $false

        while (-not $success -and $retryCount -lt $maxRetries) {
            try {
                Copy-Item -Path $sourcePath -Destination $backupPath -Recurse -Force -ErrorAction Stop
                $success = $true
            }
            catch {
                if ($_.Exception.Message -match "being used by another process" -or $_.Exception.Message -match "LOCK") {
                    $retryCount++
                    if ($retryCount -lt $maxRetries) {
                        Write-Log "Files locked (VS Code may be running), retrying in 2 seconds... (attempt $retryCount/$maxRetries)" "WARNING"
                        Start-Sleep -Seconds 2
                    }
                    else {
                        Write-Log "Files are locked by VS Code. Backup will be attempted on next scheduled run." "WARNING"
                        throw
                    }
                }
                else {
                    throw
                }
            }
        }

        if (-not $success) {
            throw "Failed to backup after $maxRetries attempts"
        }

        # Verify backup
        $backupSize = Get-BackupSize -Path $backupPath
        
        if ($backupSize -lt $config.MinBackupSizeMB) {
            Write-Log "Backup size too small ($backupSize MB) - may be incomplete" "WARNING"
            return $false
        }
        
        Write-Log "Backup completed: $backupSize MB saved to $backupPath" "SUCCESS"
        
        # Create metadata file
        $metadata = @{
            WorkspaceId = $workspaceId
            BackupDate  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            SourcePath  = $sourcePath
            BackupSize  = "$backupSize MB"
            FileCount   = (Get-ChildItem -Path $backupPath -Recurse -File).Count
        }
        
        $metadata | ConvertTo-Json | Out-File -FilePath (Join-Path $backupPath "backup-info.json")
        
        return $true
        
    }
    catch {
        Write-Log "Backup failed: $_" "ERROR"
        return $false
    }
}

function Remove-OldBackups {
    Write-Log "Cleaning up old backups (retention: $($config.RetentionDays) days)..." "INFO"
    
    if (-not (Test-Path $config.BackupRoot)) {
        return
    }
    
    $cutoffDate = (Get-Date).AddDays(-$config.RetentionDays)
    $deletedCount = 0
    $freedSpace = 0
    
    Get-ChildItem -Path $config.BackupRoot -Directory -Recurse | 
    Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
    ForEach-Object {
        $size = Get-BackupSize -Path $_.FullName
        $freedSpace += $size
            
        Write-Log "Deleting old backup: $($_.Name) ($size MB)" "INFO"
        Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        $deletedCount++
    }
    
    if ($deletedCount -gt 0) {
        Write-Log "Deleted $deletedCount old backup(s), freed $([math]::Round($freedSpace, 2)) MB" "SUCCESS"
    }
    else {
        Write-Log "No old backups to delete" "INFO"
    }
}

function Send-BackupNotification {
    param(
        [int]$SuccessCount,
        [int]$TotalCount,
        [double]$TotalSize
    )
    
    $status = if ($SuccessCount -eq $TotalCount) { "SUCCESS" } else { "WARNING" }
    $message = "Backup completed: $SuccessCount/$TotalCount workspaces backed up ($TotalSize MB total)"
    
    Write-Log $message $status
    
    # You could add email notifications here if needed
    # Or Windows toast notifications
}

function Get-BackupStatistics {
    if (-not (Test-Path $config.BackupRoot)) {
        return @{
            TotalBackups = 0
            TotalSize    = 0
            OldestBackup = $null
            NewestBackup = $null
        }
    }
    
    $allBackups = Get-ChildItem -Path $config.BackupRoot -Directory -Recurse | 
    Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' }
    
    $totalSize = 0
    foreach ($backup in $allBackups) {
        $totalSize += Get-BackupSize -Path $backup.FullName
    }
    
    $oldest = $allBackups | Sort-Object LastWriteTime | Select-Object -First 1
    $newest = $allBackups | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    return @{
        TotalBackups = $allBackups.Count
        TotalSize    = [math]::Round($totalSize, 2)
        OldestBackup = if ($oldest) { $oldest.LastWriteTime } else { $null }
        NewestBackup = if ($newest) { $newest.LastWriteTime } else { $null }
    }
}

# ============================================================================
# Main Execution
# ============================================================================

Write-Log "========================================" "INFO"
Write-Log "Augment Auto-Backup Started" "INFO"
Write-Log "========================================" "INFO"

# Create backup root directory
if (-not (Test-Path $config.BackupRoot)) {
    New-Item -ItemType Directory -Path $config.BackupRoot -Force | Out-Null
    Write-Log "Created backup directory: $($config.BackupRoot)" "SUCCESS"
}

# Check if backup is needed
if (-not (Test-BackupNeeded -BackupPath $config.BackupRoot)) {
    Write-Log "Backup not needed - exiting" "INFO"
    exit 0
}

# Get Augment workspaces
$workspaces = Get-AugmentWorkspaces

if ($workspaces.Count -eq 0) {
    Write-Log "No Augment workspaces found - nothing to backup" "WARNING"
    exit 0
}

# Backup each workspace
$successCount = 0
$totalSize = 0

foreach ($workspace in $workspaces) {
    if (Backup-AugmentData -Workspace $workspace) {
        $successCount++
        $size = Get-BackupSize -Path (Join-Path $workspace.FullName "Augment.vscode-augment")
        $totalSize += $size
    }
}

# Clean up old backups
Remove-OldBackups

# Get statistics
$stats = Get-BackupStatistics

# Send notification
Send-BackupNotification -SuccessCount $successCount -TotalCount $workspaces.Count -TotalSize $totalSize

# Display summary
Write-Log "========================================" "INFO"
Write-Log "Backup Summary:" "INFO"
Write-Log "  Workspaces backed up: $successCount/$($workspaces.Count)" "INFO"
Write-Log "  Total size: $totalSize MB" "INFO"
Write-Log "  Total backups on disk: $($stats.TotalBackups)" "INFO"
Write-Log "  Total backup size: $($stats.TotalSize) MB" "INFO"
if ($stats.OldestBackup) {
    Write-Log "  Oldest backup: $($stats.OldestBackup)" "INFO"
}
if ($stats.NewestBackup) {
    Write-Log "  Newest backup: $($stats.NewestBackup)" "INFO"
}
Write-Log "========================================" "INFO"

exit 0

