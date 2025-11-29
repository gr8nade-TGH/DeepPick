# Sharp Siege - Full Project Backup Script
# Creates a complete backup of the project (excluding node_modules)

param(
    [string]$BackupDir = "C:\Users\Tucke\Documents\DeepPick_Backups",
    [switch]$IncludeNodeModules = $false
)

# Get current git info
$gitBranch = git rev-parse --abbrev-ref HEAD 2>$null
$gitCommit = git rev-parse --short HEAD 2>$null
$gitTag = git describe --tags --exact-match 2>$null

if (-not $gitTag) {
    $gitTag = "no-tag"
}

# Create timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"

# Create backup name
$backupName = "DeepPick_${gitTag}_${gitCommit}_$timestamp.zip"
$backupPath = Join-Path $BackupDir $backupName

# Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    Write-Output "Created backup directory: $BackupDir"
}

Write-Output ""
Write-Output "Creating backup..."
Write-Output "  Branch: $gitBranch"
Write-Output "  Commit: $gitCommit"
Write-Output "  Tag: $gitTag"
Write-Output ""

# Get project root
$projectRoot = "C:\Users\Tucke\OneDrive\Desktop\DeepPick App"

# Simple copy using Compress-Archive with exclusions
Write-Output "Compressing files..."

# Get all files except excluded directories
$filesToBackup = Get-ChildItem -Path $projectRoot -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\node_modules\\' -and
    $_.FullName -notmatch '\\.next\\' -and
    $_.FullName -notmatch '\\dist\\' -and
    $_.FullName -notmatch '\\build\\' -and
    $_.FullName -notmatch '\\.turbo\\' -and
    $_.FullName -notmatch '\\.vercel\\'
}

# Create ZIP with relative paths
$filesToBackup | Compress-Archive -DestinationPath $backupPath -Force

# Get backup size
$backupSize = (Get-Item $backupPath).Length / 1MB

Write-Output ""
Write-Output "Backup created successfully!"
Write-Output "  Location: $backupPath"
Write-Output "  Size: $([math]::Round($backupSize, 2)) MB"
Write-Output ""

# Create backup manifest
$manifestPath = Join-Path $BackupDir "backup-manifest.json"
$manifest = @()

if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if ($manifest -isnot [array]) {
        $manifest = @($manifest)
    }
}

$manifest += @{
    timestamp = $timestamp
    filename = $backupName
    branch = $gitBranch
    commit = $gitCommit
    tag = $gitTag
    size_mb = [math]::Round($backupSize, 2)
    includes_node_modules = $IncludeNodeModules
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath

Write-Output "Backup manifest updated"
Write-Output ""

