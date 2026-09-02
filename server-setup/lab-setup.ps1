# L.A.B — first-server setup (runs ON THE G50). Pulls the verified Ubuntu ISO
# from Twizzler over the direct cable, verifies it, and stages the GRUB boot entry.
$ErrorActionPreference = 'Stop'
$srv    = 'http://169.254.61.215:8000'
$dir    = 'C:\Users\Public\lab'
$iso    = "$dir\ubuntu-server.iso"
$expect = 'e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433'

Write-Host ''
Write-Host '==================================================' -Foreground Cyan
Write-Host '   L.A.B first-server setup  (no USB, direct link)' -Foreground Cyan
Write-Host '==================================================' -Foreground Cyan
New-Item -ItemType Directory -Force $dir | Out-Null

Write-Host "`nChecking link to Twizzler (169.254.61.215) ..."
if (-not (Test-Connection 169.254.61.215 -Count 2 -Quiet)) {
  Write-Host "  Can't reach Twizzler over the cable." -Foreground Red
  Write-Host "   - Ethernet cable in BOTH machines?"
  Write-Host "   - This PC's Ethernet should show a 169.254.x.x address (run: ipconfig)"
  Write-Host "   - On Twizzler: firewall must allow TCP 8000 (or be off) and serve.js running"
  throw 'No link to Twizzler.'
}
Write-Host '  Link OK.' -Foreground Green

Write-Host "`n[1/3] Downloading Ubuntu Server 24.04.4 ISO (~3.4 GB) ..."
curl.exe -L -C - --retry 5 -o $iso "$srv/ubuntu-24.04.4-live-server-amd64.iso"
if ($LASTEXITCODE -ne 0) { throw 'Download failed - check cable / firewall / server.' }

Write-Host "`n[2/3] Verifying integrity (SHA256) ..."
$got = (Get-FileHash $iso -Algorithm SHA256).Hash.ToLower()
if ($got -ne $expect) {
  Write-Host "  MISMATCH!" -Foreground Red
  Write-Host "   got:      $got"
  Write-Host "   expected: $expect"
  throw 'Checksum mismatch - do not use this file.'
}
Write-Host "  OK - matches Ubuntu's published hash." -Foreground Green

Write-Host "`n[3/3] Writing the GRUB boot entry ..."
$entry = @"
menuentry "Install Ubuntu Server 24.04" {
  insmod part_gpt
  insmod part_msdos
  insmod ntfs
  search --no-floppy --file --set=root /Users/Public/lab/ubuntu-server.iso
  set isofile="/Users/Public/lab/ubuntu-server.iso"
  loopback loop `$isofile
  linux (loop)/casper/vmlinuz iso-scan/filename=`$isofile toram ---
  initrd (loop)/casper/initrd
}
"@
Set-Content "$dir\ubuntu-grub-entry.txt" $entry -Encoding ASCII

$fw = try { if (Confirm-SecureBootUEFI -ErrorAction Stop) { 'UEFI (Secure Boot ON - may need to disable it in BIOS)' } else { 'UEFI (Secure Boot off)' } }
      catch { if ($env:firmware_type) { $env:firmware_type } else { 'Legacy BIOS or UEFI - confirm in BIOS' } }

Write-Host ''
Write-Host '--------------------------------------------------' -Foreground Green
Write-Host "  DONE - ISO verified & staged: $iso" -Foreground Green
Write-Host "  Firmware: $fw"
Write-Host "  Boot entry: $dir\ubuntu-grub-entry.txt"
Write-Host '--------------------------------------------------' -Foreground Green
Write-Host ''
Write-Host 'NEXT (I''ll walk you through each in chat):'
Write-Host '  1. Download + install GRUB2Win (from your browser)'
Write-Host '  2. Add a custom menu entry - paste from ubuntu-grub-entry.txt'
Write-Host '  3. Reboot -> pick "Install Ubuntu Server 24.04"'
Write-Host '  4. In the installer: ENABLE "OpenSSH server" - then I take over via SSH.'
Write-Host ''
