# 14 · Operations runbook

Everything here runs on **lab-main-01** (`ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115`). The Manager lives in `/srv/lab/manager` as the systemd unit `lab-manager` on port 8090; Postgres is the `lab-postgres` container (db `labbrain`, user `lab`). Platform release **1.8**; the Manager build (`M-0000xx`) is in `/api/health`.

## Deploy a change
```bash
scp -i ~/.ssh/lab_ed25519 lab-hub-manager/server.js tao@192.168.1.115:/srv/lab/manager/
ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115 'sudo systemctl restart lab-manager'
curl -s http://192.168.1.115:8090/api/health        # → {"ok":true,"version":"M-0000xx","release":"1.8"}
```
Static pages (`hub/`, `admin-web/`, `kiosk/`, `wizards/`, `public/`) need no restart. Then run the smoke test from three places. Each place has different correct answers, so all three passing is the check.
```bash
scripts/smoke.sh                                    # from the LAN: admin calls must be 401 without the key
ssh … 'bash /tmp/smoke.sh http://localhost:8090'    # on the box itself: everything passes (loopback is exempt)
ssh … 'bash /tmp/smoke.sh http://100.x.y.z:8090'    # over Tailscale: family calls 401 without a sign-in, control plane 403
```

## Who can do what (1.8)
- **At home, family surface** (Hub, lists, calendar, Sauce, store, kiosk): open, as before.
- **Away from home (Tailscale or any proxy)**: the family surface needs a sign-in. `POST /api/accounts/login` returns a `session`; send it as `Authorization: Bearer …` (the `/ws` live channel takes `?s=`). Sign-up is home-only; everyone else joins by invite (Admin → Family → Invite). Phone calendar subscriptions use a read-only feed key (`POST /api/calendar/feed-key`). The control plane is 403 away, full stop.
- **The admin tier** (settings, dev team, ledgers, builders, analytics, fleet, admins, house registry, audit, engines, Tailscale, release sync, usage purge) needs the Admin Portal's session — even at home. Unlock the Portal with the USB key file; the page sends `X-Lab-Admin`. **The box itself is exempt**, so an SSH tunnel (`ssh -L 8090:localhost:8090 …`, then `http://localhost:8090/admin/`) always works as a way in.
- PINs are scrypt hashes. A PIN change signs every other device out.

## Logs
```bash
ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115 'sudo journalctl -u lab-manager -n 100 --no-pager'
```

## The AI on the server
Every Claude call (Sauce, setup wizard, dev team, ledgers, research) goes through one queue in `claude.js`: at most two at once, background work at most one of them, people first. When the CLI's own sign-in lapses, the Sauce says so and **Admin → Health** shows *AI signed out*. The fix is yours: SSH in, run `claude`, and follow its login prompt.

## Disks
The system disk is a 10 GB USB stick; Admin → Health shows it next to the data SSD (amber at 85%, red at 95%). What fills it is logs and caches: `sudo bash /srv/lab/scripts/reclaim-root.sh` caps the journal at 200 MB and clears package caches and superseded snaps. After a kernel update and a reboot, `sudo apt autoremove` drops the old kernel.

## Backups
`/srv/lab/scripts/backup-db.sh` runs from cron at 03:17 daily → `/srv/lab/backups/labbrain-YYYY-MM-DD.sql.gz` (last 14 kept, log in `backup.log`). Run it any time by hand. **Restore:** `/srv/lab/scripts/restore-db.sh <file>` stops the manager, loads the dump into a fresh database, swaps it in and keeps the old one as `labbrain_old_<epoch>`; drop those when you're sure.

## Usage data
Measurements from the personal app live in `usage_samples` (one row per device-minute, no window titles). Retention defaults to 90 days (`GET/POST /api/settings/usage`, Admin → AI settings); the purge runs nightly or via `POST /api/usage/purge`. A person can wipe their own PC's rows from the app (Settings → Your data → Delete).

## App releases
1. Bump the version in `lab-hub-app/src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `package.json` (+ `package-lock.json`), `src/config.js`, the footer in `src/index.html`, and the notes in `src/modules/whatsnew.js`.
2. Windows, on Twizzler: `npx tauri build` → `src-tauri/target/release/bundle/nsis/L.A.B Hub_<v>_x64-setup.exe` → copy to the server as `/srv/lab/manager/app-builds/LAB-Hub-Setup-win-x64.exe`, and write `app-builds/version.json` (`{version, notes, published_at}`) so installed apps see the update. The release build (full LTO) needs several GB free: if rustc fails with "memory allocation … failed", close something big and build again.
3. `git tag app-v<v> && git push origin app-v<v>` → CI builds Windows/macOS/Linux and publishes a GitHub Release. The server pulls it with `POST /api/app/sync` (also every 6 h) into `app-builds/` and rewrites `version.json` from the tag.
   *Until GitHub Actions is unblocked on the account (billing lock), only the Windows build exists; Mac/Linux get the setup wizard.*

## Away from home (Tailscale)
Full picture in `07-hosting-and-offsite-access.md`. Day to day it's **Admin → Off-site access**: state, the family link, who can reach the server, and the on/off switch.
1. Installed from Tailscale's apt repo; brought up with `sudo tailscale up --operator=tao --accept-dns=false`. If the server is ever signed out, the Admin panel shows a fresh sign-in link.
2. To let someone in: Tailscale admin console → lab-main-01 → **Share**, and Admin → Family → **Invite** for their account. They install Tailscale, accept, open the family link and sign in with the invite PIN.
3. The app learns the away address by itself the first time it's home (Settings → Where your L.A.B is shows it), and goes back home when home answers. A PC set up with the wizard from outside the house uses the address it was set up on.
4. Everything arriving over Tailscale is off-network to the Manager: family surface with a sign-in, control plane 403.

## The builders
Admin → Builders desk shows what the AI team generated (skins / widgets / pages), lets you publish or reject, and has "Skin / Widget / Page now" buttons. Pages are sanitised (no invented network facts) and never added to anyone's sidebar without them choosing it in the App Store. Published widgets also appear on the family Hub under **Cards** (live cards by default; the rest via Choose).
