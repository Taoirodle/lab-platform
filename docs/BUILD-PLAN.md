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
- [x] Rust `usage_snapshot`: CPU/RAM/uptime, foreground app + title (Win32), top processes merged by name, idle seconds (GetLastInputInfo). Battery: sysinfo can't — skipped honestly.
- [x] Rust classifier catalog (Gaming/Work/Creativity/Browsing/Comms/Entertainment/System/Other) + game-folder detection by exe path.
- [x] App sampler (`modules/telemetry.js`): 60 s cadence, 24 h local ring, batches to `/api/usage/ingest`, first sample syncs immediately; off switch in Settings.
- [x] Server M-000019: `usage_samples` (PK device+minute → idempotent), `/api/usage/ingest`, `/api/usage/summary` (tz-aware days/top apps/hours), `/api/usage/devices`.
- [x] Stats page (`modules/stats.js` + `modules/charts.js`): live strip, KPIs, 14-day stacked bars, top apps, 24 h heat strip, privacy note.
- [x] Dashboard live machine tile (now the `machine` widget).

### 2 · Dashboard as a real home screen
- [x] Widget grid (`modules/widgets.js` + `modules/dashboard.js`): machine live, today-so-far usage, family to-do with working checkboxes + add, coming-up events, house rooms/scenes, Sauce quick-ask, For-you teaser. Move/remove per widget, add bar; layout saved per install.
- [x] Widgets are modules (`LAB.widgets.register`); AI-generated widgets (tips/checklist/focus) render via trusted templates; `LAB.register` now replaces by id.
- [x] FIX: `withGlobalTauri` was never on → every native call had been silently falling back to "browser mode" in the compiled app. Now proven: exe registers itself on the server within 12 s.

### 3 · Calendar — real linking without OAuth
- [x] Server M-000020 `calendar.js`: ICS fetch (20 s timeout, 5 MB cap, LAN/loopback blocked) + dependency-free parser (folding, escapes, TZID incl. Windows names, DATE/UTC/zoned, DURATION, EXDATE, RECURRENCE-ID overrides, STATUS:CANCELLED) + RRULE expansion (DAILY/WEEKLY BYDAY/MONTHLY BYMONTHDAY+ordinal BYDAY/YEARLY, COUNT/UNTIL/INTERVAL, DST-safe). 10/10 unit cases pass. Refresh every 30 min.
- [x] `/api/calendar/feeds` (list masked URLs / add+fetch / refresh / delete), `/api/calendar/events?from&to&account_id` merged with family events. Verified live with Google's SA-holidays ICS (25 events).
- [x] App `modules/calendar.js`: month grid (Mon-start, chips by feed colour) + day agenda, add family event, link-a-calendar with per-provider steps (Google/Apple/Outlook/Other), sync/remove, share-with-family toggle. "Coming up" widget reads the merged feed.

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
- 2026-09-04 02:20 — Chunks 2+3 built + verified (server deployed M-000020; parser unit-tested; real ICS feed linked; exe telemetry end-to-end). withGlobalTauri bug found + fixed.
- 2026-09-04 01:40 — Chunk 1 shipped (`fbae844`): server deployed + smoke-tested (ingest idempotent, summary tz-correct, idle excluded); `cargo check` + release build green; exe launch-verified (7.5 MB, 38 MB RSS).
