<#
  Start condoVotes on this computer: Docker -> Supabase -> app.

  scripts\local\start-local.bat              start (production build, demo sign-in buttons on)
  scripts\local\start-local.bat -Seed        also wipe the local database and load demo data
  scripts\local\start-local.bat -Dev         use `next dev` instead of the production build
  scripts\local\start-local.bat -Build       rebuild even if the code did not change
  scripts\local\start-local.bat -NoBrowser   do not open the browser

  Stop everything with scripts\local\stop-local.bat. See docs/local-development.md.
#>
param(
  [switch]$Seed,
  [switch]$Dev,
  [switch]$Build,
  [switch]$NoBrowser
)

# Native tools write progress to stderr; check exit codes instead of stopping.
$ErrorActionPreference = "Continue"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root
$appUrl = "http://localhost:3000"
$serverTitle = "condoVotes-local-server"

function Step([string]$message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Fail([string]$message) { Write-Host "`n[x] $message" -ForegroundColor Red; exit 1 }

function Test-Docker {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Wait-Http([string]$url, [int]$seconds) {
  for ($i = 0; $i -lt $seconds; $i += 2) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5 | Out-Null
      return $true
    } catch {
      # Any HTTP answer (401, 404) means the server is up.
      if ($_.Exception.Response) { return $true }
    }
    Start-Sleep 2
  }
  return $false
}

# 1. Docker
Step "Docker"
if (-not (Test-Docker)) {
  $exe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $exe)) { Fail "Docker Desktop not found. Start Docker yourself, then run this again." }
  Write-Host "Starting Docker Desktop ..."
  Start-Process $exe
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 3
    if (Test-Docker) { $ready = $true; break }
  }
  if (-not $ready) { Fail "Docker did not start within 3 minutes." }
}
Write-Host "Docker is running."

# 2. Supabase
Step "Supabase"
$supabaseOut = (npx supabase start 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -and $supabaseOut -notmatch "already running") {
  Write-Host $supabaseOut
  if ($supabaseOut -match "ports are not available|forbidden by its access permissions") {
    Fail ("Windows is holding the Supabase ports (often after a restart).`n" +
      "    Open PowerShell as Administrator and run:`n" +
      "      net stop winnat`n      net start winnat`n" +
      "    Then run scripts\local\start-local.bat again. No data is lost.")
  }
  Fail "supabase start failed (see above)."
}
if (-not (Wait-Http "http://127.0.0.1:54321/rest/v1/" 90)) {
  Fail "Supabase API (port 54321) did not answer. Try scripts\local\stop-local.bat, then scripts\local\start-local.bat."
}
Write-Host "Supabase is running. Studio: http://localhost:54323  Mail: http://localhost:54324"

# 3. Demo data (optional)
if ($Seed) {
  Step "Demo data (wipes the local database)"
  node scripts/seed-demo.mjs --reset --consent
  if ($LASTEXITCODE -ne 0) { Fail "Seeding failed." }
}

# 4. App
Step "App"
& (Join-Path $PSScriptRoot "stop.ps1") -AppOnly -Quiet

if ($Dev) {
  $command = "npm run dev"
} else {
  # Rebuild when the code changed since the last local build.
  # Code state = commit + a hash of uncommitted changes to tracked files.
  $head = (git rev-parse HEAD 2>$null)
  $changes = (git diff HEAD -- . ":(exclude)next-env.d.ts" 2>$null | git hash-object --stdin 2>$null)
  $state = "$head $changes"
  $marker = Join-Path $root ".next\local-build-head"
  $builtState = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { "" }
  $hasBuild = Test-Path (Join-Path $root ".next\BUILD_ID")

  if ($Build -or -not $hasBuild -or $builtState -ne $state) {
    Write-Host "Building (about a minute) ..."
    # Route types left by `next dev` on another branch break the type check.
    Remove-Item -Recurse -Force (Join-Path $root ".next\dev\types") -ErrorAction SilentlyContinue
    npm run build
    if ($LASTEXITCODE -ne 0) {
      # A Next.js build worker sometimes crashes on Windows; one retry usually passes.
      Write-Host "Build failed; trying once more ..."
      Start-Sleep 5
      npm run build
    }
    if ($LASTEXITCODE -ne 0) { Fail "Build failed." }
    Set-Content -Path $marker -Value $state
  } else {
    Write-Host "Code unchanged since the last build; skipping build (use -Build to force)."
  }
  # Demo sign-in buttons need this flag in a production build (local only).
  $command = "`$env:ENABLE_LOCAL_AUTH_BYPASS='1'; npx next start -p 3000"
}

# The server runs in its own window; its log stays visible there.
$windowCommand = "`$host.UI.RawUI.WindowTitle='$serverTitle'; Set-Location '$root'; $command"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $windowCommand | Out-Null

if (-not (Wait-Http "$appUrl/login" 180)) {
  Fail "The app did not answer at $appUrl. Check the '$serverTitle' window."
}

Step "Ready"
Write-Host "App:      $appUrl"
Write-Host "Help:     $appUrl/help"
Write-Host "Same Wi-Fi (demo sign-in only): http://<this PC's IP>:3000"
Write-Host "Stop:     scripts\local\stop-local.bat"
if (-not $NoBrowser) { Start-Process $appUrl }
