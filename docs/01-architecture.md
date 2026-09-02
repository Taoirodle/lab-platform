# 01 — Architecture

## The shape of the system

```
                         ┌─────────────────────────────────────────────┐
                         │              MAIN SERVER  (the box)          │
                         │  You open it → greeted by the MANAGER GUI    │
                         │                                              │
                         │   L.A.B Hub Manager  (app #2, the brain)     │
                         │   ├─ SQL database  (manages LITERALLY all)   │
                         │   ├─ Claude CLI  +  open-source model(s)      │
                         │   ├─ Silent AI Dev Team  (builds updates/apps)│
                         │   ├─ App Store build pipeline (server-side)   │
                         │   ├─ MDM / device + family onboarding         │
                         │   ├─ Hub packaging + LAN distribution         │
                         │   └─ Home-server services: Pi-Hole, DNS,      │
                         │      reverse proxy, containers, backups       │
                         └───────────────┬───────────────┬──────────────┘
                          LAN install page│               │ agent-led onboarding
                            + account      │               │ + USB-key issue
                 ┌─────────────────────────▼──┐        ┌───▼───────────────────────┐
                 │   Home L.A.B Hub (app #1)   │        │  Admin Portal (app #3)     │
                 │   personal dashboard client │        │  onsite ops console        │
                 │   on each family PC / phone │        │  USB-key + creds to open   │
                 └─────────────────────────────┘        └────────────────────────────┘
```

## Core principles

1. **Server-centric.** The Main Server is the source of truth and the distribution point.
   Clients (Hubs) are thin-ish and disposable; the Manager is authoritative.
2. **Three separable apps, one platform.** Each is a *real* installed application with a
   real installer — never a browser tab pretending to be an app.
3. **Silent, local telemetry → intelligence.** The platform quietly logs usage, system
   state, and tagged slices of AI conversations, categorises them, and feeds the Dev Team.
   It **never leaves the household** — it lives on *your* server, not a cloud.
4. **AI as a peer operator.** The Dev Team designs, builds, documents and maintains. The
   human does the physical/onsite work and holds final physical authority (the USB key).
5. **Scales by onboarding.** Adding a family member = an account + a Hub install from the
   LAN page. Adding an admin = the full credential + USB-key ceremony.

## Data flow

- **Up (client → server):** usage events, system telemetry, activity, app requests,
  Sauce conversation slices → SQL on the Manager.
- **Down (server → client):** Hub updates/iterations, newly-built App Store apps as real
  packaged installers, automations, policies, notifications.
- **Sideways (server services):** Pi-Hole/DNS for the whole LAN, reverse proxy, container
  workloads, backups — standard home-server duties, managed by the Manager.

## Network & hosting

- The Main Server exposes a **LAN-local install web page** (create account → download the
  Hub installer). Not public internet by default.
- Nodes (helper servers, kiosks, client devices) register with the Manager (MDM-style) and
  report in. See [03 — Manager](03-lab-hub-manager.md).
- Everything is designed to run **100% inside the home**, no external accounts or SaaS.

## Target stack (proposed, to confirm when the box exists)

- **Manager app shell:** cross-platform desktop (Electron/Tauri-class) so it runs as the
  server's GUI whether the box is Linux or Windows.
- **Data:** SQL database (Postgres for scale; SQLite acceptable for a first small box).
- **Services:** Docker/containers for Pi-Hole, reverse proxy, and AI-built apps.
- **AI:** Claude CLI as the primary brain + one or more local open-source models on the GPU.
- **Client (Hub):** real packaged installer, not just an Electron shell with a LAN host.
