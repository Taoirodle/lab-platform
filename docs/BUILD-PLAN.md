# L.A.B — Continuous build plan

**Run:** started 2026-09-04 00:55 SAST, ends **2026-09-05 17:00 SAST**.
**Mandate (Tao):** build out the Hub app + platform as much as possible, autonomously. Any file/app on the PC may be used.
**Resume mechanism:** in-session cron `53 */4 * * *` re-fires this plan every 4h (survives usage-limit cutoffs while the desktop session stays open). Any turn that resumes: read the Log, `git status`, continue from the first unchecked item.

**Rules for every chunk**
1. Implement → verify for real (server: deploy + `curl`; Rust: `cargo check`, full `npx tauri build` when Rust changed; UI: load it) → commit → push → tick + Log line.
2. Repo is **public**. Never commit secrets. LAN IPs are fine.
3. Deploy = `scp -i ~/.ssh/lab_ed25519 <files> tao@192.168.1.115:/srv/lab/manager/<path>` then `ssh … 'sudo systemctl restart lab-manager'`.
4. Prefer a finished vertical slice over three half-done ones.
5. No fake data. If something can't be real yet, say so in the UI honestly.

---

## Backlog (priority order)

### 1 · Native telemetry → real Stats page  ⟵ the reason the app is native
- [ ] Rust `usage_snapshot` command: CPU load %, RAM used/total, uptime, top processes (name, cpu %, mem MB), battery if present.
- [ ] Rust process → category classifier catalog (Gaming / Work / Creativity / Browsing / Comms / System) — data table in Rust, extensible from JS.
- [ ] App sampler: every 60 s while running → local ring buffer (localStorage) → batch `POST /api/stats/ingest` (device id + account id).
- [ ] Server: `usage_samples` table + `/api/stats/ingest` + `/api/stats/summary?device=&days=` (hours by category/day, top apps, active hours, streaks).
- [ ] Stats page: canvas charts (no libs) — 14-day stacked bars by category, top apps, today's timeline, "peak hours".
- [ ] Dashboard: live CPU/RAM/uptime tile (native only; honest fallback in browser).

### 2 · Dashboard as a real home screen
- [ ] Widget grid: machine live, today's events, shared to-dos with working checkboxes (PATCH), house quick-scenes (Conductor), Sauce quick-ask, "For you" teaser.
- [ ] Widgets are modules too (`LAB.widgets.register`) so the App Store can add/remove them.

### 3 · Calendar — real linking without OAuth
- [ ] Server: `calendar_feeds` (account, name, ics_url, colour) + fetcher every 30 min + minimal ICS parser (VEVENT: DTSTART/DTEND/SUMMARY/LOCATION/RRULE daily·weekly·monthly basic) → `calendar_events`.
- [ ] `/api/calendar/feeds` CRUD, `/api/calendar/events?from=&to=` (merges feed events + shared family events).
- [ ] App: month grid + agenda, add feed (Google "secret iCal address" / Apple public share / Outlook "publish ICS" — real instructions per provider), create family event.

### 4 · Profile
- [ ] Server: accounts get `avatar` (emoji+colour), `privacy` JSON (share_stats, share_calendar), `PATCH /api/accounts/:id`, `GET /api/accounts/:id/devices`.
- [ ] App: avatar picker, privacy toggles, linked devices, sign in / switch account / sign out.

### 5 · App Store that installs things
- [ ] Widgets install into the Dashboard grid (uses `installs` table so it syncs per account).
- [ ] Effects = real CSS toggles (glass panels, ambient glow, reduce motion). Overhauls = real layout variants (compact rail, top bar).
- [ ] Packaged apps: "Install" records + opens; honest "coming from the builders" state otherwise.

### 6 · For you (personalized tab) with real content
- [ ] Rust `game_library` (Steam `libraryfolders.vdf` + `appmanifest_*.acf`; Epic manifests) and `recent_files` (Windows Recent).
- [ ] Gaming → library + playtime from stats; Work → recent docs + focus timer + today; Creativity → project folders + recent creative files; Multitasking → blend.

### 7 · Settings, native niceties, updates
- [ ] Server URL override (persisted), telemetry opt-out, data export/delete.
- [ ] Autostart (tauri-plugin-autostart), tray + minimise-to-tray, notifications (tauri-plugin-notification) for family events/to-dos.
- [ ] `GET /api/app/version` + in-app "update available" → download link.

### 8 · Web hub + Admin parity
- [ ] Admin: devices + stats overview (privacy-respecting), app version fleet view.
- [ ] Web hub: calendar feeds visible, dashboard parity where sensible.

### 9 · Release
- [ ] Bump to 0.2.0 (Cargo.toml, tauri.conf.json, package.json, config.js), tag `app-v0.2.0`, push → CI builds Win/Mac/Linux; copy Windows build into server `app-builds/`.

---

## Log
- 2026-09-04 00:55 — Run started. Cron installed. Plan written. Repo public; CI re-fired on `app-v0.1.0`.
