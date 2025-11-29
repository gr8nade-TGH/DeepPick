# Sharp Siege - List All Backups Script
# Shows all available backups with details

param(
    [string]$BackupDir = "C:\Users\Tucke\Documents\DeepPick_Backups"
)

if (-not (Test-Path $BackupDir)) {
    Write-Host "❌ No backups found. Backup directory does not exist: $BackupDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 DeepPick Backups" -ForegroundColor Cyan
Write-Host "   Location: $BackupDir" -ForegroundColor Gray
Write-Host ""

# Check for manifest
$manifestPath = Join-Path $BackupDir "backup-manifest.json"

if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath | ConvertFrom-Json
    
    Write-Host "Found $($manifest.Count) backup(s):" -ForegroundColor Green
    Write-Host ""
    
    $manifest | Sort-Object timestamp -Descending | ForEach-Object {
        Write-Host "  📁 $($_.filename)" -ForegroundColor White
        Write-Host "     Date: $($_.timestamp)" -ForegroundColor Gray
        Write-Host "     Branch: $($_.branch)" -ForegroundColor Gray
        Write-Host "     Commit: $($_.commit)" -ForegroundColor Gray
        Write-Host "     Tag: $($_.tag)" -ForegroundColor Gray
        Write-Host "     Size: $($_.size_mb) MB" -ForegroundColor Gray
        Write-Host ""
    }
} else {
    # Fallback: list files directly
    $backups = Get-ChildItem -Path $BackupDir -Filter "DeepPick_*.zip" | Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "❌ No backups found in $BackupDir" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Found $($backups.Count) backup(s):" -ForegroundColor Green
    Write-Host ""
    
    foreach ($backup in $backups) {
        $sizeMB = [math]::Round($backup.Length / 1MB, 2)
        Write-Host "  📁 $($backup.Name)" -ForegroundColor White
        Write-Host "     Date: $($backup.LastWriteTime)" -ForegroundColor Gray
        Write-Host "     Size: $sizeMB MB" -ForegroundColor Gray
        Write-Host ""
    }
}

Write-Host "💡 To restore a backup:" -ForegroundColor Yellow
Write-Host "   Expand-Archive -Path 'C:\Path\To\Backup.zip' -DestinationPath 'C:\Path\To\Restore'" -ForegroundColor Gray
Write-Host ""

