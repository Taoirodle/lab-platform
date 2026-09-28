#!/usr/bin/env bash
# L.A.B — free the system disk on lab-main-01. Run on the server, by a human:
#   sudo bash /srv/lab/scripts/reclaim-root.sh
# The OS lives on a 10 GB USB stick. What fills it is stuff that grows on its
# own: the system journal (default cap is 10% of the disk), package caches and
# superseded snap revisions. This trims all three and caps the journal so it
# can't creep back. Nothing here touches /srv/lab (the data SSD) or any data.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
before=$(df --output=avail -B1M / | tail -1)

# 1. The journal: cap at 200 MB and trim to it now.
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/00-lab-cap.conf
systemctl restart systemd-journald
journalctl --vacuum-size=200M

# 2. Package caches (apt's downloaded .debs, root's npm cache).
apt-get clean
command -v npm >/dev/null && npm cache clean --force 2>/dev/null || true

# 3. Snap keeps the previous revision of every snap; drop the disabled ones.
snap list --all | awk '/disabled/{print $1, $3}' | while read -r name rev; do
  snap remove "$name" --revision="$rev"
done

after=$(df --output=avail -B1M / | tail -1)
echo "Freed $((after - before)) MB on /  →  $(df -h / | awk 'NR==2{print $4" free, "$5" used"}')"
[ "$(uname -r)" != "$(ls -1 /boot/vmlinuz-* | sed 's|.*/vmlinuz-||' | sort -V | tail -1)" ] &&
  echo "A newer kernel is installed. After the next reboot, 'sudo apt autoremove' frees the old one too."
exit 0
