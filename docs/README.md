# L.A.B — The Home Lab Ecosystem

> **Status:** blueprint rebuilt 2026-08-19 after a full-scope correction. **No building
> happens until the first physical Main Server is set up.** These docs are the plan we
> build from, tomorrow onward.

This is **not one app**. It is an **enterprise-grade, self-hosted platform** for a home —
built to scale from one PC to a household of onboarded family members, all served by a
Main Server that runs like a real hosting service (Pi‑Hole, DNS, containers, the works).

## The three real applications

| # | Application | Runs on | What it is |
|---|-------------|---------|------------|
| 1 | **Home L.A.B Hub** | each person's PC / phone | The **personal dashboard client** — a self-adapting home-screen replacement. Packaged, hosted and **distributed *from* the Main Server**. What family members onboard onto. |
| 2 | **L.A.B Hub Manager** | the Main Server | Its **own full application** and the server's face — open the server and you're greeted by the Manager, not a headless box. The brain: AI dev team, SQL, Claude + open-source models, the App Store build pipeline, MDM/onboarding, Pi‑Hole & hosting. |
| 3 | **L.A.B Admin Portal** | the administrator's PC | Its **own real application**, delivered by a **Local Web Installer** and gated behind assigned admin credentials **+ a physical USB key/fob**. The onsite operations console. |

## Who does what

The human (you) is the **Onsite Server Administrator / IT / physical‑IoT manager** — you do
the things the AI physically cannot: rack and wire hardware, plug in IoT, hold the USB key.
The **AI operates on a higher-but-equal level** — a peer that owns the software, the
development, and the day-to-day cognitive operations. Not master and servant; two roles
that need each other.

## Read next

- [01 — Architecture](01-architecture.md) — the ecosystem, topology, and data flow
- [02 — Home L.A.B Hub](02-lab-hub.md) — the client dashboard
- [03 — L.A.B Hub Manager](03-lab-hub-manager.md) — the server brain
- [04 — Admin Portal](04-admin-portal.md) — the operations app + web installer
- [05 — Onboarding & Security](05-onboarding-and-security.md) — accounts, USB key, family
- [06 — Build Roadmap](06-build-roadmap.md) — order of work, what needs the server

## Where the current code stands

`home-lab-hub/` today is **A-000004 live / A-000005 on disk**. A-000005 wrongly put the
management brain ("Lab HQ") *inside* the Hub as a tab. Under this blueprint that logic
**moves out into the Manager** and the Hub is **slimmed back to a dashboard client**. The
A-000005 modules (dev team, fleet/MDM, activity, shared Claude runner, Sauce full‑access)
are **kept and migrated**, not thrown away. Nothing is deleted until we decide together.
