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
- [x] Server M-000021: `accounts.avatar/privacy`, `GET/PATCH /api/accounts/:id` (PIN-confirmed; new_pin validated), `GET /api/accounts/:id/devices` (+ wizard profiles), `POST /api/usage/link` (claims the device + earlier anonymous samples). All smoke-tested.
- [x] App `modules/profile.js`: log in / create (name+PIN), identity card, avatar (emoji+colour), family-visibility toggles, PIN-confirmed save, linked devices, change PIN, sign out. Sign-in links this PC.
- [x] Wizard → app handoff: wizards write a `profile.json` note (Win/Mac/Linux paths); Rust `profile_hint` reads it; boot() personalises + signs in from it. (Compiled; end-to-end needs a real wizard run.) Mac/Linux wizards' account-id parsing fixed (ids are quoted).

### 5 · App Store that installs things
- [x] Widgets: on/off into the Dashboard from the store (per-install layout; generated widgets included).
- [x] Effects (glass, glow, calm, dense) + overhauls (classic / compact rail / top bar) are real, instant, persisted (`LAB.look`).
- [x] Packaged apps: Install/Remove via `/api/store/install`; Open where a page exists (Sauce, Rooms→Automations, Family Board→Calendar, Pulse→Stats); "Not built yet" otherwise. Details panel with catalog preview.
- [ ] Later: server-side per-account widget layout sync (currently per install).

### 6 · For you (personalized tab) with real content
- [x] Rust `game_library` (Steam: all library folders via `libraryfolders.vdf` + `appmanifest_*.acf`, runtime/redist filtered; Epic `.item` manifests) and `recent_files` (Windows Recent shortcuts; Linux `recently-used.xbel`; macOS honest-empty).
- [x] `modules/foryou.js`: Gaming → library + 30-day playtime + most-played; Work → recent docs + focus timer; Creativity → recent creative files + tools used; blend when unknown/multitask.

### 7 · Settings, native niceties, updates
- [x] `modules/settings.js`: server override (store > LAB_SERVER env > default), measuring on/off, data export (Rust `save_to_downloads` → ~/Downloads JSON; clipboard fallback), delete-my-data (`DELETE /api/usage/device/:id` + local reset), theme.
- [x] Autostart via tauri-plugin-autostart (Rust-wrapped `autostart_enabled/_set`, no extra capability). Tray + notifications deferred (no tray = nothing to reopen a hidden window from; do together later).
- [x] `GET /api/app/version` reads `app-builds/version.json`; Settings shows "vX is available → Get the update" (opens `/app/download/<os>` via shell plugin). version.json written on publish.

### 8 · Web hub + Admin parity
- [x] Admin: "Hub app · devices" card (name, OS, account, last seen, active/7d — aggregate only) from `/api/usage/devices`, refreshed every 30 s.
- [x] Web hub: shared calendar now shows the merged view (family + linked calendars shared with the family, colour dots, all-day/time), family events still add/delete.
- [ ] Later: web hub shows per-member stats when `privacy.share_stats` is on.

### 9 · Release
- [x] Bumped to 0.2.0 everywhere; Windows 0.2.0 installer built locally, launch-verified, published to server `app-builds/` + `version.json`.
- [x] CI: `release` job publishes all installers to a GitHub Release on `app-v*` tags; server `POST /api/app/sync` (+ every 6 h) pulls them into `app-builds/` with canonical names and writes `version.json` from the tag. `/app/download/:os` now prefers the canonical extension (was serving the .deb for Linux by alphabetical accident).
- [ ] **BLOCKED on Tao:** every CI job on `app-v0.2.0` and `app-v0.2.1` failed with **zero steps run** (checked via the public Actions API 10:30) — jobs never start, which is what GitHub's account-level Actions/billing lock looks like, not a workflow error. Needs: github.com/settings/billing (valid payment method / spending limit) or the banner on the Actions tab. Once runs start, the tag can be re-pushed (`git push --delete origin app-v0.2.1 && git push origin app-v0.2.1`) and the server's `POST /api/app/sync` pulls Mac/Linux automatically. Until then Mac/Linux get the wizard, Windows is fully served.

### 10 · Next (in priority order)
- [x] Tray icon (Open / Quit, left-click opens), close-to-tray (Settings toggle, verified: WM_CLOSE → process alive, window hidden), autostart now launches `--minimized` into the tray, OS notifications via Rust `notify`; `modules/notify.js` reminds 15 min before timed calendar events (once, toggle in Settings).
- [x] Per-account prefs sync: `accounts.prefs` + `GET/PUT /api/accounts/:id/prefs` (whitelisted keys, merge); app pushes on any widgets/look/theme change (debounced) and pulls on boot + sign-in. Smoke-tested.
- [x] Web hub "This week" card: `/api/family/stats` (M-000022) — only members with `share_stats`, kinds + top app, avatar; honest empty state otherwise.
- [x] Builders `page` kind (M-000023): `generatePage` (blocks text/list/links/metric/checklist/steps), sanitise-then-validate, **invented network facts stripped** (the first attempt hallucinated `hub.lan`/IPs — now impossible), Dev Team standup can pick `build:"page"`, `/api/hub/generations.pages`; app `modules/genpages.js` renders them via trusted templates, opt-in from App Store → "By your builders". First real page ("Chores") generated + published on the server.
- [x] Wizard: Mac wizard sends `?arch=$(uname -m)`; `/app/download/mac` picks arm64 vs x64 dmg. LICENSE now carries the full GPLv3 text.

### 11 · Next wave (pick top-down)
- [x] The Sauce knows the calendar + list (today/tomorrow merged events + open to-dos in context, local time), new `todo_done` action (best-match tick), timed `event`s. Verified live: answered "just one thing left…", ticked it off, "tomorrow's wide open".
- [x] Family calendar export `GET /api/calendar/family.ics` (family events + shared feeds, folded, DST-safe) — round-trips through our own parser. Subscribe card in the app Calendar; URL shown on the web hub.
- [x] Admin "Builders · generations" desk: waiting-for-you list (publish / reject / restore), recent, published counts, Skin/Widget/Page "now" buttons.
- [x] Web hub "Get the App": Download badge shows the version; the install modal shows version, date and notes.
- [x] Kiosk: "Coming up · next 7 days" (merged calendar) + "This week · who's sharing" panels.
- [x] Stats: tap a day → timeline strip (runs of app / idle, now-marker) + longest runs list, from `/api/usage/day` (verified: minutes collapse into runs, gaps split).
- [x] Windows wizard offers to run the installer after download.
- [x] Sauce widget keeps the last exchanges (per install) and sends them as history.

### 12 · Wave three (pick top-down)
- [x] Home / away: `LAB.pickServer()` pings home (2.5 s) then the away address; footer shows `home / away / offline`; while offline it re-picks every 45 s and re-renders on recovery. Settings has Home + Away fields.
- [x] Offline-tolerant reads: every GET cached per install; unreachable → cached answer + "Offline — showing what your L.A.B last said (as of …)" bar; writes throw honestly. Verified in-browser: cache hit in 2 ms, bar + footer flip, write refused, recovery to home.
- [x] Automations page: devices list (online dot, toggle, remove), add a device (WLED / WiZ / push / virtual; push shows its token once), "check who's online", save a scene from the current light states, run scenes, motion→scene builder. Verified in-browser: add → listed → removed, no errors.
- [x] Web hub: "Ask The Sauce" card with short history; refreshes list/calendar when it acts.
- [x] Manager hygiene: `settings.usage.retention_days` (7–3650, default 90) via `GET/POST /api/settings/usage`; nightly purge + `POST /api/usage/purge`; audited. Smoke-tested.
- [x] Weekly digest: Sunday ≥18:00, once, real numbers only (active time, top kind, streak) via the native notifier; skipped when nothing was measured.
- [x] Command palette (Ctrl/Cmd+K): pages, scenes, or anything else goes to The Sauce with the answer inline. Verified in-browser (open → filter → Enter → navigated; scenes listed).

### 13 · Wave four (pick top-down)
- [x] Nightly Postgres backup: `scripts/backup-db.sh` installed at `/srv/lab/scripts`, cron 03:17, keep 14; first dump made (144 KB, 22 tables). `scripts/restore-db.sh` swaps a dump in safely.
- [x] `scripts/smoke.sh`: 28 endpoint checks — all pass against the live server.
- [x] Kiosk: touch-sized "Ask The Sauce" box; refreshes rooms/calendar when it acts.
- [x] Admin: "Keep usage data for N days" next to the AI controls (wired to `/api/settings/usage`).
- [x] Device page: Rust `live_device` (disks with mount/fs/free/total, network interfaces with MAC + totals) → storage fill bars + per-interface ↓/↑ rates computed between polls.
- [x] `docs/14-operations.md`: deploy, logs, backups/restore, usage data, releases, Tailscale steps, builders desk.

### 14 · Wave five (pick top-down)
- [x] Live updates: one middleware announces every successful change under `/api/(shared|calendar|conductor|kiosk|sauce|store)` as `{type:'shared', what}` on `/ws` (Sauce stays quiet unless it acted); app `modules/live.js` (backoff reconnect, restarts on recovery, won't re-render while you type) and the web hub refresh instantly. Verified with a real WS client: add/toggle/delete → 3 events, plain answer → none.
- [x] Web hub "Your calendars" card: list (family badge, sync state), remove, link with name/colour/share — phones can link Google/Apple/Outlook without the app.
- [x] Admin audit trail card (`GET /api/audit`, home-network only), refreshed every 20 s.
- [x] Stats CSV export (`/api/usage/export.csv`, tz-aware) → saved to Downloads from the app. Verified: real Twizzler minutes in the CSV.
- [x] Mac/Linux wizards offer to open/run the download.

---

## Log
- 2026-09-04 00:55 — Run started. Cron installed. Plan written. Repo public; CI re-fired on `app-v0.1.0`.
- 2026-09-04 18:45 — Waves 13+14 shipped (M-000024): backups cron + restore, smoke.sh 28/28, kiosk/hub Sauce, retention control, live WS updates (verified with a real WS client), hub calendar linking, audit trail, CSV export, live_device page. 0.2.3 final build running (then tag). Audit log shows Tao using the new Admin desk at 16:15.
- 2026-09-04 17:40 — Wave 12 built + verified in-browser (home/away/offline, device onboarding, palette; server retention purge, hub Sauce card). Build for 0.2.3 in progress.
- 2026-09-04 16:58 — **0.2.2 released** (day timeline, family.ics subscribe card, Sauce widget history; web: admin builders desk, hub version, kiosk panels; wizard launches installer). Browser pass clean on all 10 pages; exe verified; installer + version.json published; tag `app-v0.2.2`. Wave 11 complete; wave 12 defined. (Turn gap 11:00→16:54: cron fires queued while the previous turn ran.)
- 2026-09-04 10:40 — Wave 11: Sauce context + todo_done + family.ics shipped and verified live (M-000023). CI found blocked at account level (zero-step jobs) — needs Tao.
- 2026-09-04 10:27 — **0.2.1 released** (tray/close-to-tray/reminders, prefs sync, family This-week, Mac arch, builders `page` kind with anti-hallucination sanitiser; the Dev Team autonomously shipped a "Handbook" page). Manager M-000023. Windows installer + version.json published; tag `app-v0.2.1` pushed. Chunks 1–10 complete; section 11 is the next wave.
- 2026-09-04 09:55 — 0.2.0 tagged (`1e88816`, CI + GitHub Release + server sync loop). Then tray/close-to-tray/notifications, prefs sync (M-000022), family "This week", Mac arch pick, LICENSE — all verified; bumping to 0.2.1 for a consistent tag.
- 2026-09-04 03:45 — Chunks 6+7+8 built + verified: all 10 pages driven in a real browser with zero runtime errors; autostart build launch-verified; web hub + admin pages deployed. Versions bumped to 0.2.0; release build running; `docs/13-hub-app.md` written.
- 2026-09-04 03:05 — Chunks 4+5 shipped (`4b55d26`, `4b1e376`); installer republished to server app-builds; Chunk 6 written, build pending.
- 2026-09-04 02:20 — Chunks 2+3 built + verified (server deployed M-000020; parser unit-tested; real ICS feed linked; exe telemetry end-to-end). withGlobalTauri bug found + fixed.
- 2026-09-04 01:40 — Chunk 1 shipped (`fbae844`): server deployed + smoke-tested (ingest idempotent, summary tz-correct, idle excluded); `cargo check` + release build green; exe launch-verified (7.5 MB, 38 MB RSS).
