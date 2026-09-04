# 13 · The Hub app (native, modular)

The personal L.A.B Hub is a **real compiled desktop app** — Tauri v2: a small Rust shell around the OS webview. Not Electron, not a PWA. One binary per OS (Windows built on Twizzler; macOS + Linux by CI on the `app-v*` tag). GPL-3.0-or-later.

```
lab-hub-app/
  src/                 the modular front-end (plain JS, no framework, no build step)
    app.js             LAB core: register/go/nav, api(), store, native bridge, skins, looks
    pages.js           icons + head/soon helpers + the Sauce / Automations / Device pages
    modules/           one file per feature; each registers itself
      telemetry.js     the sampler (native only)
      charts.js        canvas charts (no libs, theme-aware)
      stats.js         slot 9 · Stats
      widgets.js       widget registry + built-ins + AI-generated wrapper
      dashboard.js     slot 1 · Dashboard (widget grid)
      calendar.js      slot 3 · Calendar (month grid, agenda, ICS feeds)
      profile.js       slot 2 · Profile (sign-in, avatar, privacy, devices, PIN)
      appstore.js      slot 5 · App Store (installs, overhauls, effects, themes, widgets)
      foryou.js        slot 7 · For you (library, recent files, focus, studio)
      settings.js      slot 10 · Settings (server, measuring, autostart, updates, data)
  src-tauri/
    src/lib.rs         every native command
    Cargo.toml         tauri 2, shell + autostart plugins, sysinfo, windows-sys (Windows only)
    tauri.conf.json    withGlobalTauri: true  ← required, or the app silently runs as a browser
```

## The modular spine

A page is `LAB.register({ id, label, icon, order, show?, dynLabel?, render(el, ctx) })`. Registering the same `id` again **replaces** the module — that's how a module file overrides a stub, and how a future overhaul can swap a whole page. The sidebar is rendered from the registry; nothing hard-codes the page list.

Widgets are the same idea one level down: `LAB.widgets.register({ id, title, size, native?, render })`. The Dashboard paints `LAB.widgets.installed()` (saved per install). AI-generated widgets from the server's builders arrive as **structured payloads** (`{template: tips|checklist|focus, items[]}`) and are rendered by trusted templates — never raw HTML.

`ctx` carries `me` (account), `profile` (wizard personalization), `device` (native probe), `server`.

## Native commands (Rust → JS via `LAB.invoke`)

| command | what | where it works |
|---|---|---|
| `device_info` | hostname, OS, CPU, RAM, disks | all |
| `quick_load` | CPU %, RAM, uptime — cheap, polled for live tiles | all |
| `usage_snapshot` | foreground app + window title, top processes merged by name, idle seconds, kind classification | foreground/idle: **Windows** (Win32); processes: all |
| `game_library` | Steam (every library folder) + Epic | Win/Mac/Linux paths |
| `recent_files` | Windows Recent shortcuts; Linux `recently-used.xbel` | macOS returns empty (honestly) |
| `profile_hint` | the note the install wizard left on disk | all |
| `autostart_enabled` / `autostart_set` | start with the PC | all (tauri-plugin-autostart) |
| `save_to_downloads` | write the data export | all |
| `server_url` | `LAB_SERVER` env or the default | all |

In a plain browser every one of these returns `null` and the UI says so — no fake data.

## Telemetry (the reason the app is native)

Once a minute while the app is open: `usage_snapshot` → one sample `{t, app, cat, cpu, mem, idle}`. What counts as "what you're doing" is the focused app unless it's the OS shell or the Hub itself, then the busiest real process. Samples go into a 24 h local ring and are POSTed to `/api/usage/ingest` in batches (the very first sample syncs immediately so a fresh install appears on the server within seconds). **Window titles are shown live and never stored or sent.** Idle (>5 min without input) is recorded but excluded from "active" totals. The server key is `(device_id, minute)`, so re-sends are idempotent. Off switch: Settings → Usage measuring. Delete everything: Settings → Your data.

Kinds: Gaming · Work · Creativity · Browsing · Comms · Entertainment · System · Other. Anything running out of a Steam/Epic/Riot/GOG/Xbox/Battle.net folder is Gaming whatever it's called; the rest is a name catalog in `lib.rs` (extend freely).

## Calendar without OAuth

Google, Apple and Outlook all hand out a private **iCal subscription URL**. The server (`calendar.js`) fetches those every 30 minutes, parses ICS itself (folding, escapes, TZID incl. Windows names, DATE/UTC/zoned, DURATION, EXDATE, RECURRENCE-ID overrides, STATUS:CANCELLED) and expands RRULEs (daily / weekly BYDAY / monthly BYMONTHDAY + ordinal BYDAY / yearly; COUNT, UNTIL, INTERVAL; DST-safe) into a −30/+365-day window of plain rows. `/api/calendar/events` merges those with the family calendar. A feed marked *shared* shows on the family Hub too. LAN/loopback URLs are refused.

## Sign-in and the wizard handoff

The app signs in with the same **name + PIN** as the family Hub (Profile page). Signing in links this PC (and any samples it sent before) to the account via `/api/usage/link`. Profile edits (avatar, what the family can see, PIN) are confirmed with the PIN.

The install wizard, after analysing the PC, writes a note — `%LOCALAPPDATA%\LAB\profile.json` / `~/Library/Application Support/LAB/profile.json` / `~/.config/lab/profile.json` — with the profile id and who signed in. `boot()` reads it once via `profile_hint`, so the app is personalised **and signed in** on first launch.

## Looks

`LAB.look` = layout overhaul (`classic` / `compact` rail / `topbar`) + effects (`glass`, `glow`, `calm`, `dense`) as `<html>` classes, saved per install and applied at boot. Colour themes come from the server's builders (`/api/hub/generations`) as CSS-variable sets. All of it is in the App Store.

## Releasing

1. Bump `version` in `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `package.json`, `src/config.js` (and the footer in `index.html`).
2. `npx tauri build` on Windows → `src-tauri/target/release/bundle/nsis/*.exe`; copy to the server as `/srv/lab/manager/app-builds/LAB-Hub-Setup-win-x64.exe` and write `app-builds/version.json` (`{version, notes, published_at}`) — the app's Settings page compares against it.
3. `git tag app-vX.Y.Z && git push origin app-vX.Y.Z` → CI builds Windows, macOS (arm64 + x86_64) and Linux; drop the artifacts into `app-builds/` so `/app/download/<os>` serves them.
