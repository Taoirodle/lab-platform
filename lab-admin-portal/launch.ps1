# ============================================================
#  L.A.B Admin Portal — desktop launcher (Windows)
#  Starts the Electron Portal pointed at your Main Server's Manager.
#  Usage:  $env:LAB_MANAGER_URL="http://192.168.1.115:8090"; ./launch.ps1
#  (LAB_MANAGER_URL is optional; it defaults to the LAN address baked in.)
# ============================================================
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path        # ...\lab-admin-portal
$repo = Split-Path -Parent $here                                # project root

# Reuse the Hub's Electron runtime (no separate install needed)
$electron = Join-Path $repo 'home-lab-hub\node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) {
  # fall back to a locally installed electron on PATH
  $onPath = (Get-Command electron -ErrorAction SilentlyContinue)
  if ($onPath) { $electron = $onPath.Source }
  else { Write-Error "Electron runtime not found. Expected: $electron"; exit 1 }
}

if ($env:LAB_MANAGER_URL) { Write-Host "Manager: $env:LAB_MANAGER_URL" }
else { Write-Host "Manager: default (http://192.168.1.115:8090)" }

Write-Host "Launching L.A.B Admin Portal..."
& $electron $here
