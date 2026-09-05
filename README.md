# L.A.B — a self-hosted home platform

L.A.B runs a household from its own server: a shared family surface on the web, a **native personal app** per person, a wall kiosk, and an AI (**The Sauce**) that acts on the house from plain language. It is built by one family for itself, in the open, under the GPL.

```
lab-hub-manager/   the Manager — Node + Postgres on the home server (:8090)
  hub/             web hub: the shared family surface (lists, calendar, house, Sauce, Get the App)
  admin-web/       Admin Portal (USB-key gated): fleet, builders desk, health, audit, invites
  kiosk/           the wall kiosk (rooms, coming up, lists, Sauce)
  showcase/        the living-room keynote + phone remote
  wizards/         per-OS setup wizards (analyse the PC → personalised app)
  calendar.js      ICS feeds (Google/Apple/Outlook) parsed + expanded in-house
  conductor.js     our own device engine: WLED / WiZ / push sensors / virtual, scenes, automations (motion + clock)
  sauce.js         The Sauce: agentic, tool-validated, refuses anything outside the home
  builders.js      the AI build team's artifacts: skins, widgets, whole pages (sanitised)
  ledgers.js       the evolving ledgers the AI team learns from
lab-hub-app/       the personal app — Tauri v2 (Rust + OS webview), modular pages, ~8 MB
docs/              blueprint, design language, hosting, operations, the build plan/log
scripts/           backup / restore / smoke test
```

## What it does today

- **Personal app** (Windows now; macOS/Linux via CI): Dashboard of widgets, Stats measured natively (what's in front of you, once a minute — window titles never leave the PC), Calendar with linked Google/Apple/Outlook feeds, Profile, App Store (installs, looks, themes, widgets, pages made by the builders), Automations (devices, scenes, motion + clock triggers), "For you" (your game library, recent files), Settings (home/away server, autostart, tray, reminders, export/delete). Works offline from what it last saw; finds the server at home or over Tailscale.
- **Web hub**: shared lists, family calendar + a phone-subscribable `.ics`, house map, Ask The Sauce, Get the App, "This week" for members who opt in.
- **The Sauce**: knows the calendar, the lists and the devices; adds to-dos, ticks them off, puts events on the calendar, runs scenes, switches devices — only when asked, and never anything outside the home.
- **The builders**: the AI team proposes and ships skins, widgets and whole pages from the ledgers; invented facts are stripped; nothing lands in a sidebar without the person choosing it.
- **Ops**: nightly Postgres backups, retention purge, live updates over one WebSocket, audit trail, 28-check smoke suite.

## Run it

Server: see `docs/14-operations.md`. App: `cd lab-hub-app && npm install && npm run build` (Rust + Tauri prerequisites), or grab the installer from the server's *Get the App* page. Architecture and the privacy model: `docs/13-hub-app.md`. Everything that was built, verified and what's next: `docs/BUILD-PLAN.md`.

## License

GPL-3.0-or-later — see `LICENSE`.
