# ============================================================================
# Augment Backup - Task Scheduler Setup Script
# ============================================================================
# This script sets up Windows Task Scheduler to run automatic backups
# Run this script ONCE to set up the scheduled task
# ============================================================================

#Requires -RunAsAdministrator

param(
    [ValidateSet("Daily", "Hourly", "Weekly")]
    [string]$Frequency = "Daily",
    
    [ValidateRange(0, 23)]
    [int]$Hour = 2,  # 2 AM by default
    
    [ValidateRange(0, 59)]
    [int]$Minute = 0
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Augment Backup Scheduler Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$taskName = "Augment-Conversation-Backup"
$scriptPath = Join-Path $PSScriptRoot "Augment-Auto-Backup.ps1"
$logPath = "C:\Users\Tucke\OneDrive\Backups\Augment-Conversations\Logs"

# Verify script exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "ERROR: Backup script not found at: $scriptPath" -ForegroundColor Red
    Write-Host "Please ensure Augment-Auto-Backup.ps1 is in the same directory as this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Script found: $scriptPath" -ForegroundColor Green
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "WARNING: Scheduled task '$taskName' already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to replace it? (Y/N)"
    
    if ($response -ne 'Y' -and $response -ne 'y') {
        Write-Host "Setup cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Existing task removed." -ForegroundColor Green
    Write-Host ""
}

# Create the scheduled task action
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Silent" `
    -WorkingDirectory $PSScriptRoot

# Create the trigger based on frequency
switch ($Frequency) {
    "Hourly" {
        Write-Host "Setting up HOURLY backup schedule..." -ForegroundColor Cyan
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
    }
    "Daily" {
        Write-Host "Setting up DAILY backup schedule at $Hour`:$($Minute.ToString('00'))..." -ForegroundColor Cyan
        $trigger = New-ScheduledTaskTrigger -Daily -At "$Hour`:$($Minute.ToString('00'))"
    }
    "Weekly" {
        Write-Host "Setting up WEEKLY backup schedule (Sundays at $Hour`:$($Minute.ToString('00')))..." -ForegroundColor Cyan
        $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "$Hour`:$($Minute.ToString('00'))"
    }
}

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Create the principal (run as current user)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

# Register the scheduled task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Automatically backs up Augment AI conversation history to OneDrive" `
        -ErrorAction Stop | Out-Null
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Scheduled task created!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: $taskName" -ForegroundColor White
    Write-Host "  Frequency: $Frequency" -ForegroundColor White
    
    if ($Frequency -eq "Daily" -or $Frequency -eq "Weekly") {
        Write-Host "  Time: $Hour`:$($Minute.ToString('00'))" -ForegroundColor White
    }
    
    Write-Host "  Script: $scriptPath" -ForegroundColor White
    Write-Host "  Logs: $logPath" -ForegroundColor White
    Write-Host ""
    
    # Test run option
    Write-Host "Would you like to run a test backup now? (Y/N)" -ForegroundColor Yellow
    $testResponse = Read-Host
    
    if ($testResponse -eq 'Y' -or $testResponse -eq 'y') {
        Write-Host ""
        Write-Host "Running test backup..." -ForegroundColor Cyan
        Write-Host ""
        
        & $scriptPath
        
        Write-Host ""
        Write-Host "Test backup completed! Check the output above for results." -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Your backups will run automatically based on the schedule" -ForegroundColor White
    Write-Host "2. Check logs at: $logPath" -ForegroundColor White
    Write-Host "3. Backups are saved to: C:\Users\Tucke\OneDrive\Backups\Augment-Conversations" -ForegroundColor White
    Write-Host "4. Old backups (>30 days) are automatically deleted" -ForegroundColor White
    Write-Host ""
    Write-Host "To manage the task:" -ForegroundColor Cyan
    Write-Host "  - Open Task Scheduler (taskschd.msc)" -ForegroundColor White
    Write-Host "  - Look for '$taskName'" -ForegroundColor White
    Write-Host "  - Or run: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to create scheduled task!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure you're running PowerShell as Administrator" -ForegroundColor White
    Write-Host "2. Check that Task Scheduler service is running" -ForegroundColor White
    Write-Host "3. Verify the script path is correct" -ForegroundColor White
    exit 1
}

