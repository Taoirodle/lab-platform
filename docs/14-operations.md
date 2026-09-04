# 14 · Operations runbook

Everything here runs on **lab-main-01** (`ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115`). The Manager lives in `/srv/lab/manager` as the systemd unit `lab-manager` on port 8090; Postgres is the `lab-postgres` container (db `labbrain`, user `lab`).

## Deploy a change
```bash
scp -i ~/.ssh/lab_ed25519 lab-hub-manager/server.js tao@192.168.1.115:/srv/lab/manager/
ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115 'sudo systemctl restart lab-manager'
curl -s http://192.168.1.115:8090/api/health        # → {"ok":true,"version":"M-0000xx"}
```
Static pages (`hub/`, `admin-web/`, `kiosk/`, `wizards/`) need no restart. Then run the smoke test:
```bash
scripts/smoke.sh                                    # 28 checks against the LAN server
```

## Logs
```bash
ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115 'sudo journalctl -u lab-manager -n 100 --no-pager'
```

## Backups
`/srv/lab/scripts/backup-db.sh` runs from cron at 03:17 daily → `/srv/lab/backups/labbrain-YYYY-MM-DD.sql.gz` (last 14 kept, log in `backup.log`). Run it any time by hand. **Restore:** `/srv/lab/scripts/restore-db.sh <file>` stops the manager, loads the dump into a fresh database, swaps it in and keeps the old one as `labbrain_old_<epoch>`; drop those when you're sure.

## Usage data
Measurements from the personal app live in `usage_samples` (one row per device-minute, no window titles). Retention defaults to 90 days (`GET/POST /api/settings/usage`, Admin → AI settings); the purge runs nightly or via `POST /api/usage/purge`. A person can wipe their own PC's rows from the app (Settings → Your data → Delete).

## App releases
1. Bump the version in `lab-hub-app/src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `package.json`, `src/config.js`, and the footer in `src/index.html`.
2. Windows, on Twizzler: `npx tauri build` → `src-tauri/target/release/bundle/nsis/L.A.B Hub_<v>_x64-setup.exe` → copy to the server as `/srv/lab/manager/app-builds/LAB-Hub-Setup-win-x64.exe`, and write `app-builds/version.json` (`{version, notes, published_at}`) so installed apps see the update.
3. `git tag app-v<v> && git push origin app-v<v>` → CI builds Windows/macOS/Linux and publishes a GitHub Release. The server pulls it with `POST /api/app/sync` (also every 6 h) into `app-builds/` and rewrites `version.json` from the tag.
   *Until GitHub Actions is unblocked on the account (billing lock), only the Windows build exists; Mac/Linux get the setup wizard.*

## Away from home (Tailscale)
1. On the server: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up` (one browser authorisation), then `tailscale ip -4` → the 100.x address.
2. Family members install Tailscale on their devices and join the same tailnet.
3. In the app: Settings → Where your L.A.B is → **Away** = `http://100.x.y.z:8090`. The app tries home first, then away, and shows which it's on in the footer.
4. Control-plane routes stay home-network-only behind the off-network guard; the family surface (hub, calendar, list, Sauce, store) works over Tailscale.

## The builders
Admin → Builders desk shows what the AI team generated (skins / widgets / pages), lets you publish or reject, and has "Skin / Widget / Page now" buttons. Pages are sanitised (no invented network facts) and never added to anyone's sidebar without them choosing it in the App Store.
