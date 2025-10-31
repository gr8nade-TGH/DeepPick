# Augment Conversation Recovery Script
# This script extracts conversation history from Augment's LevelDB storage

Write-Host "=== Augment Conversation Recovery Tool ===" -ForegroundColor Cyan
Write-Host ""

# Define workspace storage paths
$workspaceStoragePath = "C:\Users\Tucke\AppData\Roaming\Code\User\workspaceStorage"
$outputDir = "C:\Users\Tucke\OneDrive\Desktop\DeepPick App\recovered-conversations"

# Create output directory
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "Created output directory: $outputDir" -ForegroundColor Green
}

# Find all Augment workspace directories
$augmentDirs = Get-ChildItem -Path $workspaceStoragePath -Directory | 
    Where-Object { Test-Path (Join-Path $_.FullName "Augment.vscode-augment\augment-kv-store") }

Write-Host "Found $($augmentDirs.Count) workspace(s) with Augment data:" -ForegroundColor Yellow
$augmentDirs | ForEach-Object { Write-Host "  - $($_.Name)" }
Write-Host ""

$conversationCount = 0

foreach ($dir in $augmentDirs) {
    $kvStorePath = Join-Path $dir.FullName "Augment.vscode-augment\augment-kv-store"
    $workspaceName = $dir.Name
    
    Write-Host "Processing workspace: $workspaceName" -ForegroundColor Cyan
    
    # Get all .ldb files
    $ldbFiles = Get-ChildItem -Path $kvStorePath -Filter "*.ldb" | Sort-Object LastWriteTime
    
    foreach ($ldbFile in $ldbFiles) {
        Write-Host "  Reading: $($ldbFile.Name) ($([math]::Round($ldbFile.Length/1KB, 2)) KB)" -ForegroundColor Gray
        
        try {
            # Read file as bytes and convert to UTF8
            $bytes = [System.IO.File]::ReadAllBytes($ldbFile.FullName)
            $text = [System.Text.Encoding]::UTF8.GetString($bytes)
            
            # Try to extract JSON objects that look like conversation exchanges
            $pattern = '\{"uuid":"[^"]+","conversationId":"[^"]+","request_message":"[^"]*","response_text":"[^"]*"'
            $matches = [regex]::Matches($text, $pattern)
            
            if ($matches.Count -gt 0) {
                Write-Host "    Found $($matches.Count) potential conversation fragments" -ForegroundColor Green
            }
            
            # Also look for larger JSON structures
            $jsonPattern = '\{[^\{\}]*"request_message"[^\{\}]*"response_text"[^\{\}]*\}'
            $jsonMatches = [regex]::Matches($text, $jsonPattern)
            
            # Extract readable text segments
            $segments = $text -split '\x00' | Where-Object { 
                $_.Length -gt 100 -and 
                ($_ -match 'request_message|response_text|conversationId')
            }
            
            if ($segments.Count -gt 0) {
                $outputFile = Join-Path $outputDir "$workspaceName-$($ldbFile.BaseName).txt"
                
                $output = @"
=== Workspace: $workspaceName ===
=== File: $($ldbFile.Name) ===
=== Last Modified: $($ldbFile.LastWriteTime) ===
=== Size: $([math]::Round($ldbFile.Length/1KB, 2)) KB ===

"@
                
                foreach ($segment in $segments) {
                    # Clean up the segment
                    $cleaned = $segment -replace '[\x00-\x1F\x7F-\x9F]', ' '
                    $cleaned = $cleaned -replace '\s+', ' '
                    $cleaned = $cleaned.Trim()
                    
                    if ($cleaned.Length -gt 50) {
                        $output += "`n--- Conversation Fragment ---`n"
                        $output += $cleaned
                        $output += "`n"
                    }
                }
                
                $output | Out-File -FilePath $outputFile -Encoding UTF8
                Write-Host "    Saved to: $outputFile" -ForegroundColor Green
                $conversationCount++
            }
            
        } catch {
            Write-Host "    Error processing file: $_" -ForegroundColor Red
        }
    }
    
    Write-Host ""
}

Write-Host "=== Recovery Complete ===" -ForegroundColor Cyan
Write-Host "Total files created: $conversationCount" -ForegroundColor Green
Write-Host "Output directory: $outputDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review the recovered conversation files in: $outputDir"
Write-Host "2. The data is fragmented but should contain your conversation history"
Write-Host "3. You may need to manually piece together conversations"
Write-Host ""

# Also create a summary of what was found
$summaryFile = Join-Path $outputDir "RECOVERY_SUMMARY.txt"
$summary = @"
=== Augment Conversation Recovery Summary ===
Date: $(Get-Date)

Workspaces Scanned: $($augmentDirs.Count)
Files Created: $conversationCount

Workspace Details:
"@

foreach ($dir in $augmentDirs) {
    $kvStorePath = Join-Path $dir.FullName "Augment.vscode-augment\augment-kv-store"
    $ldbFiles = Get-ChildItem -Path $kvStorePath -Filter "*.ldb" -ErrorAction SilentlyContinue
    $totalSize = ($ldbFiles | Measure-Object -Property Length -Sum).Sum
    
    $summary += "`n`nWorkspace: $($dir.Name)"
    $summary += "`n  Path: $kvStorePath"
    $summary += "`n  LDB Files: $($ldbFiles.Count)"
    $summary += "`n  Total Size: $([math]::Round($totalSize/1KB, 2)) KB"
    $summary += "`n  Last Modified: $(($ldbFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime)"
}

$summary += "`n`n=== Notes ==="
$summary += "`nAugment stores conversations in LevelDB format (.ldb files)"
$summary += "`nThe data is binary-encoded but contains UTF-8 text fragments"
$summary += "`nConversations may be split across multiple files"
$summary += "`nSome data may be corrupted or incomplete due to the binary format"

$summary | Out-File -FilePath $summaryFile -Encoding UTF8
Write-Host "Summary saved to: $summaryFile" -ForegroundColor Green

