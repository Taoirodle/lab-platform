# 09 · Autonomy Architecture — the Ledger System

The Major Update (2026-09-01, `M-000013`): the AI build team went from "files changelog rows" to a **grounded, remembering, artifact-producing organism**. This doc is the map.

## Why it exists

Tao's verdict on the first auto-builders: *"pretty shit — they either don't do anything or make changes that are really small."* Root cause: they built **blind** (no memory, no grounding) and their "shipping" was **fictional** (a DB row, QC pre-stamped). The Ledger System fixes both.

## The four Ledgers (one evolving SQL store: `ledger_entries`)

| Ledger | Holds | Grows from |
|---|---|---|
| **Team** | Build ideology, north star, guardrails, open plans, evolution log | Standups, research, evolve passes |
| **Client** | Who each user is, likes/dislikes, usage signals, feedback | Telemetry firehose + feedback buttons |
| **Admin** | How admins interact, what they approve/reject, preferences | Approval decisions, admin actions |
| **Kiosk** | Per-device usage (scoped by kiosk name, e.g. `hall`) + a `.md` device doc per kiosk (`/srv/lab/data/kiosks/`) | Room toggles, kiosk telemetry |

Mechanics: entries are **upsertable facts** (keyed, weight grows with reinforcement) or **append-only logs**. `signal()` is the cheap counter path used by telemetry. `digest(ledger)` renders a compact text brief for any brain call.

**Everything expands autonomously:**
- every `/api/events` hit → `learnFromEvent()` → client/kiosk ledgers
- every admin decision → `learnAdmin()` → admin ledger
- every ~90 min one ledger runs **`evolve()`** — the on-server Claude brain reads the digest and *refines the ideology itself* (sharpen, add convictions, log how thinking shifted)
- every ~4 h a **research agent** fires, filing findings + seeding team plans
- **monthly** (or on demand) the **master synthesis** reads ALL four ledgers, writes the big-picture summary + the next cycle's one big bet into `master_synthesis`, and re-points the team's north star

## The build loop (now honest)

```
ledgers.digest('team')  ─┐
client signals           ├─► proposeAI() — every proposal must trace to a plan/north star
open research topics    ─┘        │
                                  ▼
                        build: "skin" | "widget" | "none"
                                  │
                 ┌────────────────┴────────────────┐
        real artifact generated              plain proposal
        validated ("tested")                 QC = 'pending' (not stamped)
        → generations table                  sig ≥ 8 → admin approval
        → published → LIVE IN THE HUB        sig < 8 → filed
```

- **Skins** are validated for legibility (contrast heuristic) before publishing; the Hub's theme menu lists them, users apply them live.
- **Widgets** are structured data rendered by trusted Hub templates (`tips` / `checklist` / `focus`) — the AI designs content + accent, the Hub renders it safely. No AI-authored code executes in the client.
- `shipped` now means **a tested artifact exists**. Proposals without artifacts stay `pending` QC.

## Feedback + the real brake

The Hub shows an occasional feedback toast (smart buttons: **Love it / Meh / Bug / Idea / Too much**, ≤1/day). Every tap feeds the client + team ledgers. **"Too much" literally decrements `settings.ai.activity`** — the family can slow the AI down without opening the Admin Portal. The Admin Portal's sliders remain the governance dial: as trust grows, raise **aggressiveness** and the proposals get bolder (the prompt scales with it).

## The 3D Neural Map (Admin Portal)

`/api/ledgers/graph` renders the live ledger tree as an orbiting 3D network in the Admin Portal — L.A.B core → four ledger nodes → kinds → entries. Drag to orbit, scroll to zoom, **click a node to expand it downward** into its SQL children. It refreshes every minute, so it visibly grows as the system learns. Pulses run along the core edges.

## Active memory enhancers (how it doesn't lose the plot)

The methodology, as implemented:
1. **North star + guardrails are load-bearing** — injected into every proposal prompt; proposals that can't trace to them are structurally discouraged.
2. **Weight = reinforcement** — repeated signals strengthen a fact; stale one-offs sink in every digest (ordered by weight, capped).
3. **Digest, not dump** — brains get a compact, ranked brief, never the whole table. Bounded context = no drift.
4. **Evolution log** — each evolve pass records *how the thinking changed*, so the next pass sees its own trajectory (self-audit, not amnesia).
5. **Separation of stores** — team convictions never mix with client facts; the master synthesis is the only place everything meets, on purpose, rarely.
6. **The plot is checkable** — guardrail: "Every build must trace to a ledger plan or the north star. No random churn."

## Honest scaffolds (built to receive, not faked)

- **Camera 3D room mapping (floor map):** needs a physical camera + an explicit privacy go-ahead. The kiosk ledger + device `.md` docs are the landing zone; the mapping pipeline is a next-cycle build once hardware exists. Not faked.
- **Live internet scouring:** research agents currently reason from the brain's knowledge and are honest about it (their prompt forbids claiming live browsing). Giving the server brain unsupervised web access + user-data harvesting is an admin governance call — flip it deliberately, not silently.
- **Home Assistant adapter:** the master synthesis's chosen "one big bet" — turn Rooms from demo into real device control via an `adapter` artifact kind. Queued as the next major cycle.

## Endpoints added (M-000013)

`/api/ledgers` · `/api/ledgers/graph` · `/api/ledgers/:ledger` · `/api/ledgers/:ledger/evolve` · `/api/master/synthesis` · `/api/master/latest` · `/api/feedback` (GET/POST) · `/api/generations` (+ `/skin`, `/widget`, `/:id/:decision`) · `/api/hub/generations` · `/api/research` (+ `/run`)
