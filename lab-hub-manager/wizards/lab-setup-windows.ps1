# ============================================================
#  L.A.B — Setup Wizard (Windows)
#  Signs you in, quietly reads how you use THIS PC, sends the report to your
#  L.A.B agents, and shows the personalization they build for your Hub app.
#  Privacy: it counts file types + installed-app names + basic specs. It never
#  reads file contents and nothing leaves your home network.
#  Run:  iwr http://192.168.1.115:8090/app/wizard/win -OutFile lab-setup.ps1 ; ./lab-setup.ps1
# ============================================================
param([string]$Server = "http://192.168.1.115:8090")
$ErrorActionPreference = "Stop"
function Line { param($c="Gray") process { Write-Host $_ -ForegroundColor $c } }

Write-Host "`n  ┌─ L.A.B SETUP ─────────────────────────────┐" -ForegroundColor Magenta
Write-Host   "  │  Your home, handled.                       │" -ForegroundColor Magenta
Write-Host   "  └────────────────────────────────────────────┘`n" -ForegroundColor Magenta

# 1) account -----------------------------------------------------------------
$mode = Read-Host "  Do you have an account? (y = sign in / n = create)"
$name = Read-Host "  Your name"
$pin  = Read-Host "  PIN (4-8 digits)"
$path = if ($mode -eq 'y') { "/api/accounts/login" } else { "/api/accounts" }
try {
  $acct = Invoke-RestMethod -Uri "$Server$path" -Method Post -ContentType "application/json" -Body (@{ name=$name; pin=$pin } | ConvertTo-Json)
  Write-Host "`n  ✓ Signed in as $($acct.name)`n" -ForegroundColor Green
} catch { Write-Host "  ✗ $($_.ErrorDetails.Message)" -ForegroundColor Red; exit 1 }

# 2) analyse this PC ---------------------------------------------------------
Write-Host "  Reading how you use this machine..." -ForegroundColor Cyan

# installed app names (both registry hives)
$apps = @()
foreach ($k in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
                 "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
                 "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
  try { $apps += (Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object -Expand DisplayName) } catch {}
}
$apps = $apps | Sort-Object -Unique

# file-type tallies across the user's real folders
$fileTypes = @{}
$folders = @("Documents","Downloads","Pictures","Desktop","Videos","Music") | ForEach-Object { Join-Path $env:USERPROFILE $_ }
foreach ($f in $folders) {
  if (Test-Path $f) {
    Get-ChildItem $f -Recurse -File -ErrorAction SilentlyContinue -Depth 3 | ForEach-Object {
      $e = $_.Extension.ToLower(); if ($e) { $fileTypes[$e] = 1 + ($fileTypes[$e] | ForEach-Object { $_ }) }
    }
  }
}
$topTypes = $fileTypes.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 15 |
            ForEach-Object { @{ ext = $_.Key; count = $_.Value } }

$cpu = (Get-CimInstance Win32_Processor).Name
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 0)
$gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1 -Expand Name)

$report = @{
  os = "Windows"; hostname = $env:COMPUTERNAME
  specs = @{ cpu = $cpu; ramGB = $ramGB; gpu = $gpu }
  apps = ($apps | Select-Object -First 120)
  fileTypes = $topTypes
}
Write-Host "  ✓ Found $($apps.Count) apps, $($fileTypes.Count) file types`n" -ForegroundColor Green

# 3) hand it to the agents ---------------------------------------------------
Write-Host "  Sending to your L.A.B agents..." -ForegroundColor Cyan
try {
  $res = Invoke-RestMethod -Uri "$Server/api/wizard/profile" -Method Post -ContentType "application/json" `
         -Body (@{ account_id = $acct.id; report = $report } | ConvertTo-Json -Depth 6)
  $p = $res.personalization
  Write-Host "`n  ── YOUR PERSONALIZED L.A.B ──────────────────" -ForegroundColor Magenta
  Write-Host "  Archetype : $($p.archetype)"       -ForegroundColor White
  Write-Host "  Your tab  : $($p.personalizedTab)"  -ForegroundColor White
  Write-Host "  Stats     : $($p.statsKind)"        -ForegroundColor White
  if ($p.theme) { Write-Host "  Theme     : $($p.theme)" -ForegroundColor White }
  Write-Host "`n  $($p.report)`n" -ForegroundColor Gray
  Write-Host "  Profile id: $($res.id)" -ForegroundColor DarkGray
  # leave a note for the app: it reads this on first launch and is personalised + signed in immediately
  $hintDir = Join-Path $env:LOCALAPPDATA "LAB"; New-Item -ItemType Directory -Force -Path $hintDir | Out-Null
  @{ id = $res.id; account_id = $acct.id; account_name = $acct.name; server = $Server; archetype = $p.archetype; at = (Get-Date).ToString("o") } |
    ConvertTo-Json | Set-Content -Path (Join-Path $hintDir "profile.json") -Encoding UTF8
} catch { Write-Host "  ✗ Could not reach the agents: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }

# 4) fetch the app (once CI has published a build) ---------------------------
Write-Host "  Checking for your app build..." -ForegroundColor Cyan
try {
  $out = Join-Path $env:USERPROFILE "Downloads\L.A.B-Hub-Setup.exe"
  Invoke-WebRequest -Uri "$Server/app/download/win" -OutFile $out -ErrorAction Stop
  Write-Host "  ✓ Downloaded to $out" -ForegroundColor Green
  $go = Read-Host "  Run the installer now? [Y/n]"
  if ($go -eq '' -or $go -match '^[Yy]') { Start-Process -FilePath $out; Write-Host "  Installer opened — the app signs you in on first launch.`n" -ForegroundColor Green }
  else { Write-Host "  Run it whenever you like — it's in your Downloads.`n" -ForegroundColor Yellow }
} catch {
  Write-Host "  · The native Windows build isn't published yet." -ForegroundColor Yellow
  Write-Host "    Your profile is saved — the app will pick it up the moment it lands.`n" -ForegroundColor Yellow
}
Write-Host "  Done. Welcome to the L.A.B.`n" -ForegroundColor Magenta
