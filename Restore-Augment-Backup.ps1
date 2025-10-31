# ============================================================================
# Augment Conversation Restore Script
# ============================================================================
# This script restores Augment AI conversations from backup
# Use this if you accidentally delete conversations or need to recover data
# ============================================================================

param(
    [string]$WorkspaceId = "",
    [string]$BackupDate = "",
    [switch]$ListBackups = $false,
    [switch]$Force = $false
)

# Configuration
$backupRoot = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations"
$workspaceStoragePath = "C:\Users\Tucke\AppData\Roaming\Code\User\workspaceStorage"

# ============================================================================
# Functions
# ============================================================================

function Show-Banner {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Augment Conversation Restore Tool" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-AvailableBackups {
    if (-not (Test-Path $backupRoot)) {
        Write-Host "No backups found at: $backupRoot" -ForegroundColor Red
        return @()
    }
    
    $backups = @()
    
    Get-ChildItem -Path $backupRoot -Directory | ForEach-Object {
        $workspaceId = $_.Name
        $workspaceBackups = Get-ChildItem -Path $_.FullName -Directory | 
            Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' } |
            Sort-Object Name -Descending
        
        foreach ($backup in $workspaceBackups) {
            $infoFile = Join-Path $backup.FullName "backup-info.json"
            $info = if (Test-Path $infoFile) {
                Get-Content $infoFile | ConvertFrom-Json
            } else {
                @{
                    WorkspaceId = $workspaceId
                    BackupDate = $backup.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                    BackupSize = "Unknown"
                    FileCount = (Get-ChildItem -Path $backup.FullName -Recurse -File).Count
                }
            }
            
            $backups += [PSCustomObject]@{
                WorkspaceId = $workspaceId
                BackupTimestamp = $backup.Name
                BackupDate = $info.BackupDate
                Size = $info.BackupSize
                FileCount = $info.FileCount
                Path = $backup.FullName
            }
        }
    }
    
    return $backups
}

function Show-BackupList {
    $backups = Get-AvailableBackups
    
    if ($backups.Count -eq 0) {
        Write-Host "No backups found!" -ForegroundColor Yellow
        Write-Host "Backup location: $backupRoot" -ForegroundColor Gray
        return
    }
    
    Write-Host "Available Backups:" -ForegroundColor Cyan
    Write-Host ""
    
    $backups | Group-Object WorkspaceId | ForEach-Object {
        Write-Host "Workspace: $($_.Name)" -ForegroundColor Yellow
        Write-Host ("=" * 80) -ForegroundColor Gray
        
        $_.Group | Format-Table @(
            @{Label="Backup Date"; Expression={$_.BackupDate}; Width=20}
            @{Label="Timestamp"; Expression={$_.BackupTimestamp}; Width=20}
            @{Label="Size"; Expression={$_.Size}; Width=15}
            @{Label="Files"; Expression={$_.FileCount}; Width=10}
        ) -AutoSize
        
        Write-Host ""
    }
    
    Write-Host "Total backups: $($backups.Count)" -ForegroundColor Green
    Write-Host ""
}

function Select-Backup {
    param(
        [string]$WorkspaceId,
        [string]$BackupDate
    )
    
    $backups = Get-AvailableBackups
    
    if ($backups.Count -eq 0) {
        Write-Host "No backups available to restore!" -ForegroundColor Red
        return $null
    }
    
    # If workspace ID provided, filter by it
    if ($WorkspaceId) {
        $backups = $backups | Where-Object { $_.WorkspaceId -eq $WorkspaceId }
        
        if ($backups.Count -eq 0) {
            Write-Host "No backups found for workspace: $WorkspaceId" -ForegroundColor Red
            return $null
        }
    }
    
    # If backup date provided, filter by it
    if ($BackupDate) {
        $backups = $backups | Where-Object { $_.BackupTimestamp -like "$BackupDate*" }
        
        if ($backups.Count -eq 0) {
            Write-Host "No backups found for date: $BackupDate" -ForegroundColor Red
            return $null
        }
    }
    
    # If multiple backups, let user choose
    if ($backups.Count -gt 1) {
        Write-Host "Multiple backups found. Please select one:" -ForegroundColor Yellow
        Write-Host ""
        
        for ($i = 0; $i -lt $backups.Count; $i++) {
            $backup = $backups[$i]
            Write-Host "[$($i + 1)] $($backup.BackupDate) - Workspace: $($backup.WorkspaceId) - $($backup.Size)" -ForegroundColor White
        }
        
        Write-Host ""
        $selection = Read-Host "Enter number (1-$($backups.Count))"
        
        try {
            $index = [int]$selection - 1
            if ($index -ge 0 -and $index -lt $backups.Count) {
                return $backups[$index]
            } else {
                Write-Host "Invalid selection!" -ForegroundColor Red
                return $null
            }
        } catch {
            Write-Host "Invalid input!" -ForegroundColor Red
            return $null
        }
    }
    
    return $backups[0]
}

function Restore-Backup {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject]$Backup
    )
    
    $sourcePath = $Backup.Path
    $workspaceId = $Backup.WorkspaceId
    $destinationPath = Join-Path $workspaceStoragePath "$workspaceId\Augment.vscode-augment"
    
    Write-Host ""
    Write-Host "Restore Details:" -ForegroundColor Cyan
    Write-Host "  From: $sourcePath" -ForegroundColor White
    Write-Host "  To: $destinationPath" -ForegroundColor White
    Write-Host "  Backup Date: $($Backup.BackupDate)" -ForegroundColor White
    Write-Host "  Size: $($Backup.Size)" -ForegroundColor White
    Write-Host ""
    
    # Check if destination exists
    if (Test-Path $destinationPath) {
        Write-Host "WARNING: Augment data already exists at destination!" -ForegroundColor Yellow
        Write-Host "This will OVERWRITE existing conversations!" -ForegroundColor Red
        Write-Host ""
        
        if (-not $Force) {
            $confirm = Read-Host "Are you sure you want to continue? (Type 'YES' to confirm)"
            
            if ($confirm -ne 'YES') {
                Write-Host "Restore cancelled." -ForegroundColor Yellow
                return $false
            }
        }
        
        # Backup existing data before overwriting
        $backupExisting = Join-Path $destinationPath "..\Augment.vscode-augment.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Host "Creating backup of existing data to: $backupExisting" -ForegroundColor Yellow
        Copy-Item -Path $destinationPath -Destination $backupExisting -Recurse -Force
        Write-Host "Existing data backed up." -ForegroundColor Green
        Write-Host ""
        
        # Remove existing data
        Remove-Item -Path $destinationPath -Recurse -Force
    }
    
    try {
        # Create workspace directory if it doesn't exist
        $workspaceDir = Join-Path $workspaceStoragePath $workspaceId
        if (-not (Test-Path $workspaceDir)) {
            New-Item -ItemType Directory -Path $workspaceDir -Force | Out-Null
        }
        
        # Copy backup to destination
        Write-Host "Restoring backup..." -ForegroundColor Cyan
        Copy-Item -Path (Join-Path $sourcePath "Augment.vscode-augment") -Destination $destinationPath -Recurse -Force -ErrorAction Stop
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "SUCCESS! Backup restored!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Restart VS Code" -ForegroundColor White
        Write-Host "2. Open the workspace that was restored" -ForegroundColor White
        Write-Host "3. Your conversations should now be available in Augment" -ForegroundColor White
        Write-Host ""
        
        return $true
        
    } catch {
        Write-Host ""
        Write-Host "ERROR: Restore failed!" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $false
    }
}

# ============================================================================
# Main Execution
# ============================================================================

Show-Banner

# List backups mode
if ($ListBackups) {
    Show-BackupList
    exit 0
}

# Interactive restore
Write-Host "This tool will help you restore Augment conversations from backup." -ForegroundColor White
Write-Host ""

# Select backup to restore
$selectedBackup = Select-Backup -WorkspaceId $WorkspaceId -BackupDate $BackupDate

if (-not $selectedBackup) {
    Write-Host ""
    Write-Host "No backup selected. Exiting." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Tip: Use -ListBackups to see all available backups" -ForegroundColor Gray
    exit 1
}

# Restore the backup
$success = Restore-Backup -Backup $selectedBackup

if ($success) {
    exit 0
} else {
    exit 1
}

