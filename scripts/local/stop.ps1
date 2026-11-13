<#
  Stop condoVotes on this computer: the app, then Supabase. Data is kept.

  stop-local.bat             stop the app and Supabase
  stop-local.bat -AppOnly    stop only the app
  stop-local.bat -Docker     also quit Docker Desktop
#>
param(
  [switch]$AppOnly,
  [switch]$Docker,
  [switch]$Quiet
)

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$serverTitle = "condoVotes-local-server"

function Say([string]$message) { if (-not $Quiet) { Write-Host $message } }

# App: the server window from start-local, Next.js processes of this project,
# and anything still listening on port 3000.
$ids = @()
$ids += Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match [regex]::Escape($serverTitle) } |
  ForEach-Object { $_.ProcessId }
$ids += Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match [regex]::Escape($root) -or ($_.CommandLine -match "next" -and $_.CommandLine -match "condo_vote") } |
  ForEach-Object { $_.ProcessId }
$ids += Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { $_.OwningProcess }

$ids = $ids | Where-Object { $_ -and $_ -ne $PID } | Sort-Object -Unique
foreach ($id in $ids) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}
Say ("App stopped" + $(if ($ids.Count -eq 0) { " (was not running)." } else { "." }))

if ($AppOnly) { exit 0 }

Set-Location $root
docker info *> $null
if ($LASTEXITCODE -eq 0) {
  npx supabase stop 2>&1 | Out-Null
  Say "Supabase stopped (data kept in Docker volumes)."
} else {
  Say "Docker is not running; Supabase is already stopped."
}

if ($Docker) {
  Get-Process "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
  Say "Docker Desktop closed."
}
