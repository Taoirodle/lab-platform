# 04 — L.A.B Admin Portal  (App #3 — the operations console)

**What it is:** its **own real application** — never a fake shell — for the **onsite Server
Administrator / IT / physical‑IoT manager**. It is delivered by a **Local Web Installer**
and locked behind **assigned admin credentials + a physical key** (USB stick / fob; a
YubiKey later if wanted — probably overkill for now).

This is the app you use to do the things the AI can't: physically manage hardware, wire
IoT, approve/steer the Dev Team, run the server, and hold the literal keys to the kingdom.

## How you get it (the ceremony)

1. The Main Server is set up; the **Manager greets you** on the box.
2. On your PC, open the server's **Local Web Installer** page (LAN only).
3. **Get onboarded by the Agents** on the server side — an **interview / "Employee
   Sign-in"** with one of the Dev Team agents. They provision your admin identity.
4. **Download the Admin app** — issued onto a **locked-down USB stick** (or similar).
5. Install it on your PC and **log in with assigned Admin Credentials**.
6. The Admin app **only opens when the USB key/fob is present**. No key → no entry.

## What it controls

- **The Dev Team** — review, steer, approve/reject the crew's proposals and builds; read
  change logs and asset docs. (Peer relationship: you set direction, they execute.)
- **The Fleet** — Main/Helper servers and Kiosks; add, configure, onboard, monitor.
- **Devices & family** — MDM: enrol devices, onboard/offboard family members, set policies.
- **Home-server ops** — Pi-Hole, DNS, containers, backups, updates, health.
- **App Store governance** — what may be built, sizes/build budgets, publishing.
- **Security & audit** — credentials, keys, the full audit trail of AI actions.

## Security model (first pass)

- **Something you know** — assigned admin credentials (per-admin, not shared).
- **Something you have** — the issued USB key/fob, required to unlock the app each session.
- **Local only** — the Admin app talks to the Manager over the LAN; nothing is exposed to
  the public internet.
- **Everything audited** — every admin action and every AI action is logged in the SQL
  brain, reviewable in the portal.

## Why its own app (not a browser tab)

Because it holds real power (server ops, credentials, the whole fleet), it must be a proper,
hardened, installed application with the key requirement enforced at launch — not something
anyone on the LAN could reach in a browser.
