# 03 — L.A.B Hub Manager  (App #2 — the server brain)

**What it is:** its **own full application** that lives on the Main Server and **is the
server's face**. Open the Main Server and you are **greeted by the Manager GUI** — not a
headless Linux terminal. It hosts, packages and distributes the Home L.A.B Hub, runs the AI
dev team and the App Store build pipeline, and manages every device and family member.

Think: *Home Assistant + an MDM + a CI/CD build farm + a home-server control panel*, made
personal, and driven by AI.

## Responsibilities

### 1. Host & distribute the Hub
- Packages the Home L.A.B Hub and serves it from a **LAN-local install web page**.
- Manages versions, pushes updates/iterations down to every client.

### 2. The SQL brain
- A full **SQL database that manages literally everything**: users, devices, telemetry,
  activity, automations, app catalog + builds, Dev Team state, policies, audit.
- Single source of truth for the whole household.

### 3. AI compute
- **Claude CLI** as the primary brain + **one or more open-source models** on the GPU.
- A resident manager persona per node (the onboarding "charter" concept from A-000005).

### 4. The Silent AI Dev Team
- Agents with roles + personalities who **silently** watch usage, system state and tagged
  slices of AI conversations, **categorise them**, and act as a real development team:
  ship Hub updates, manage workflow, and **build App Store apps on demand**.
- They keep **written change logs and asset documentation**; the human reviews/approves as
  the onsite admin (peer-level, not master).

### 5. App Store build pipeline (server-side)
- Maintains **previews** with **server-computed sizes and build times** (the human never
  sees the build machinery).
- On **Download**, kicks off a real build → produces a **packaged, docked application**,
  widget, tool or function → delivered to the requesting client.

### 6. MDM / onboarding
- Registers and manages every node and device (PCs, phones, smart devices, kiosks, helper
  servers). Handles **family-member onboarding** and **admin onboarding** (see
  [05 — Onboarding & Security](05-onboarding-and-security.md)).

### 7. Home-server services
- **Pi-Hole**, DNS, reverse proxy, container orchestration, scheduled backups — everything
  a real home server runs — presented and controlled through the Manager UI.

## Node types (the fleet)

- **Main Server** — full backend + the Manager GUI + Docker + database + Claude manager.
- **Helper Server** — headless muscle: compute/storage the Main servers borrow, **no front
  end**. Add these to scale out.
- **Kiosk** — a room-facing single/multi-function screen (smart lights, media, a panel)
  with a custom UI that fits its surroundings.

## Migration from A-000005

The modules already written for the Hub move here largely intact:
`activity` (telemetry), `fleet` (nodes/MDM + onboarding bundles), `devteam` (the crew,
standups, proposals, change logs), `claude` (shared CLI runner), and the Sauce
**full-access** executor become **Manager-side services** backed by SQL instead of JSON files.
