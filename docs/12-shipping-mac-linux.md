# 12 · Shipping the Mac + Linux builds (CI)

The Windows `.exe` is built and served. Mac and Linux can't be built off the Linux server (Apple needs a Mac) or the G50 — so we use **GitHub Actions' free runners**, which build all three OSes at once. The workflow is already written (`.github/workflows/build-app.yml`) and a `.gitignore` is in place so nothing heavy or sensitive gets pushed. Verified: no credentials live in the repo (the DB creds are only in the server's gitignored `.env`).

## One-time: push it (≈5 min, needs your GitHub login)

Use a **private** repo (Actions is free on private repos, and it keeps the family's platform yours).

```bash
cd "C:/Users/Tao Volkwyn/AI PC mangement and Diagnostics"
git init
git add .
git commit -m "L.A.B platform"
gh repo create lab-platform --private --source=. --push   # gh CLI does login + create + push
# …or make the repo on github.com yourself, then:
#   git remote add origin https://github.com/<you>/lab-platform.git
#   git branch -M main && git push -u origin main
```

## Build all three OSes

On GitHub → the repo → **Actions** → **build-lab-hub-app** → **Run workflow**. (Or `git tag app-v0.1.0 && git push --tags`.)

~10 minutes later it produces installers for **Windows, macOS (Apple silicon + Intel), and Linux** as downloadable artifacts.

## Put them on the download page

Download the artifacts, then drop them on the server so *Get the App* serves real downloads for every OS:

```bash
scp -i ~/.ssh/lab_ed25519 <the-mac.dmg> <the-linux.AppImage> tao@192.168.1.115:/srv/lab/manager/app-builds/
```

The `/api/app/targets` endpoint auto-detects them by OS and flips those buttons from "Get the wizard" to "Download." Done — the whole family, any machine.

## Notes

- **Signing** (optional, later): unsigned apps show a "unknown publisher" warning on first run. Windows: an EV cert (~$$). macOS: an Apple Developer account ($99/yr) for notarization. Not needed for family use — they click through once.
- **Auto-update** (optional, later): Tauri's updater can pull new versions from the server; wire it when the app stabilises.
