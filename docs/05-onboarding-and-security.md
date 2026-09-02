# 05 — Onboarding & Security

Two very different journeys: **family members** (easy, friendly) and **administrators**
(deliberate, key-gated). Both are orchestrated by the Manager on the Main Server.

## Family-member onboarding (the easy path)

1. Person opens the server's **LAN install web page** in a browser.
2. **Creates an account** (name, avatar, PIN/password; role = member).
3. Downloads and runs the **Home L.A.B Hub installer** (a real installer, not just an
   Electron shell + LAN host).
4. Signs in → their **personal, self-adapting Hub** is provisioned, tied to their account,
   with member-level permissions and policies set by the admin.

Adding a family member is meant to be a two-minute, self-serve flow — that's what "start
onboarding my family" means at scale.

## Administrator onboarding (the deliberate path)

Layered on top of the family path, with a real ceremony (see
[04 — Admin Portal](04-admin-portal.md)):

1. **Agent-led interview / "Employee Sign-in."** One of the server's Dev Team agents
   interviews the prospective admin and provisions an admin identity in SQL.
2. **Assigned admin credentials** are issued (per-admin, never shared).
3. The **Admin app is delivered on a locked-down USB key/fob**.
4. The Admin app **launches only with the key present** + correct credentials.
5. All admin power (fleet, MDM, Dev Team, home-server ops) unlocks from there.

## Roles (first cut)

| Role | Can | Cannot |
|------|-----|--------|
| **Member** (family) | Use their Hub, request App Store apps, control permitted devices/rooms | Manage the fleet, other users, or server services |
| **Administrator** (you) | Everything: fleet, MDM, Dev Team direction, server ops, credentials | (Physically) nothing is off-limits — but every action is audited |
| **AI Dev Team** | Design, build, document, maintain, propose | Ship without the process; do physical/onsite work |

## Security posture

- **Two-factor for admins:** credentials (know) + USB key/fob (have). YubiKey is a future
  option if the fob proves too soft — flagged as likely overkill for now.
- **Local-first:** the whole system runs on the home LAN; nothing is published to the
  public internet by default.
- **Silent telemetry, household-private:** usage, system state and tagged AI-conversation
  slices are logged and categorised automatically — but they live on **your** server and
  never leave the house. Admin controls retention and can purge.
- **Full audit trail:** every AI action and admin action is recorded in the SQL brain and
  reviewable in the Admin Portal.

## Open questions to settle before building this layer

- Exact **key mechanism** (plain USB volume ID vs. smartcard/FIDO/YubiKey).
- **Account/identity store** shape in SQL (users, roles, sessions, devices).
- Whether members can self-register or require admin approval.
- Password/credential recovery model (self-hosted, no cloud fallback).
