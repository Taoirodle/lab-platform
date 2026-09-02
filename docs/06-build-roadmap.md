# 06 — Build Roadmap

> **Gate:** real building resumes **after the first Main Server is physically set up.**
> Until then this is planning + documentation only. (Your call — you're the onsite admin
> who stands the box up.)

## Phase 0 — now (done tonight)
- [x] Absorb the full-scope, enterprise, three-app correction.
- [x] Close everything running so the PC is free.
- [x] Rebuild the documentation from scratch around the Manager + Admin Portal.

## Phase 1 — stand up the Main Server (needs YOU, onsite)
- [ ] Physically set up the box (even a modest one is fine to start).
- [ ] Decide + confirm: **OS** (Linux desktop vs Windows), **DB** (Postgres vs SQLite),
      **app shell** (Electron vs Tauri). Recommendations in [01](01-architecture.md).
- [ ] Put Claude CLI on it; confirm GPU/model availability for open-source models.

## Phase 2 — L.A.B Hub Manager, first build (AI-led, unattended)
- [ ] New standalone app `lab-hub-manager/` — the server GUI you're greeted by.
- [ ] SQL schema: users, devices, telemetry, activity, apps/builds, dev-team, audit.
- [ ] Migrate A-000005 modules in: `activity`, `fleet`/MDM, `devteam`, `claude` runner,
      Sauce full-access — backed by SQL instead of JSON files.
- [ ] Hub packaging + **LAN install web page** with **account creation**.
- [ ] Home-server services: Pi-Hole, reverse proxy, container host, backups.

## Phase 3 — Home L.A.B Hub, reworked as a client
- [ ] Remove the "Lab HQ" tab; slim to a self-adapting **dashboard client**.
- [ ] Real installer (beyond Electron+LAN host), tied to a **user account**.
- [ ] Wire client → Manager: telemetry up, updates/apps/policies down.
- [ ] App Store previews use **server-computed** sizes/build-times; Download → server build.

## Phase 4 — Admin Portal + Local Web Installer
- [ ] Standalone `lab-admin-portal/` app (real app, hardened).
- [ ] **Local Web Installer** page served by the Manager.
- [ ] **Agent-led onboarding interview / employee sign-in.**
- [ ] **USB-key/fob-gated** launch + assigned admin credentials.
- [ ] Full ops surface: fleet, MDM, Dev Team direction, home-server ops, audit.

## Phase 5 — family onboarding at scale
- [ ] Member self-serve flow polished; roles/policies enforced.
- [ ] Per-member Hubs provisioned from the server.
- [ ] Kiosks for shared rooms; smart-home control live in Rooms.

## Carried-over intent (don't lose these)
- The Sauce: reactive 3D/particle boot, voice API now → open-source voice tied to Claude
  CLI later.
- Rooms: 2D/3D builder → full smart home.
- Silent telemetry that categorises usage + tagged AI-conversation slices, feeding the Dev
  Team — household-private, admin-controlled.
- "Everything a real application has" + QOL throughout.
- AI as a **higher-but-equal peer**; human as **onsite admin/IT/IoT**.

## What I need from you to start Phase 2
Just three answers (my recommendations noted): **server OS** (→ cross-platform Electron until
you decide), **database** (→ Postgres in Docker, SQLite fallback), and **which app to build
first** (→ the Manager). We settle these when you've got the box.
