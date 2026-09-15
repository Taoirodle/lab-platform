# 15 · The House Model — the household's single source of truth

> The Hub is not useful because it has features. It is useful because it *knows things*.
> Everything in this document exists to answer one question: **what does this household actually consist of?**

## The principle: discover, then confirm

Never ask a person to type what a machine can already find out.

| Domain | How the Hub finds out | What the human does |
|---|---|---|
| Hardware | scans the LAN (ARP, open ports, MAC vendor) | names it, adds what's offline |
| Software | reads installed apps on each PC at install time | picks which ones to connect |
| Subscriptions | detected from the apps, asked once per app | confirms tier and price |
| Money | imported from statements, or entered once | corrects and categorises |
| Behaviour | measured continuously (already working) | nothing |
| The house itself | asked once, in plain language | corrects a drawing |

The registry is the *shared* truth (admin: Tao and Dad). The census is the *personal* truth (each person's own machine). The Sauce reads both.

---

## Layer 1 — The Registry (shared, admin-gated)

The operational reality of the house. Behind the admin key, on the LAN only, never in git.

**Providers** — who we're with. ISP, bank, insurer, municipality, mobile network, medical aid, armed response, contractors. Name, kind, reference (last four only — never a full account number), phone, portal URL.

**Money out** — every recurring and one-off cost: label, provider, category, amount, currency (ZAR), cadence, the day it lands, whole-house or personal, start and end dates. This is where "what are we actually paying for" gets answered.

**Debt** — balance, original, rate, minimum payment, term end. Enough to compute payoff order and what the interest really costs per month. Never enough to move money.

**Kit** — every physical thing: PCs, laptops, phones, TVs, consoles, router, switches, access points, printer, VoIP handsets, NAS, cameras, appliances. Make, model, serial, MAC and IP, room, owner, purchase date, price, warranty end, status.

**Contacts** — the plumber, the electrician, the landlord, the neighbour with the spare key. Who to call, and for what.

**Property and utilities** — address, erf, municipal account, meter numbers and readings over time, refuse day (**Monday** — South Africa), geyser, alarm and armed response, gate motor, solar / inverter / batteries, pool or borehole.

**Connectivity** — ISP and package, line speed, router and access point models and their real capability, SSIDs, VoIP numbers. The thing that answers "can we run another 4K stream".

**Facts** — the open-ended rest. Where the water shutoff is, which breaker feeds the server, whose name the wifi account is in.

Every row records **provenance**: stated by a person, observed by a machine, or inferred. That is what later lets the Hub notice when two sources disagree — the only honest way an AI can judge whether a sensor is telling the truth.

---

## Layer 2 — The Census (personal, per machine)

What the install wizard becomes. Today it lists apps and picks an archetype. Instead it should **detect what you run and negotiate an integration for each one.**

The flow: *"We found 34 apps on this PC. Nine of them the L.A.B can do something with."* Each gets a specific offer and a switch — never a blanket permission request.

### The integration catalogue

Each entry declares how to detect it, what it can give, what it costs the house, and what permission that needs.

| App | Detected by | What we can actually get | Needs |
|---|---|---|---|
| **Steam** | `libraryfolders.vdf`, `appmanifest_*.acf` | library, install sizes, last played — **already working**; playtime per game and achievements via the Web API | API key |
| **Spotify** | install path / process | top artists and tracks, recently played, playlists, **and the subscription tier itself** (`/v1/me` returns `product`) | OAuth |
| **Blender** | recent-files list, `.blend` count | projects, where they live, when you last touched them | local read |
| **DaVinci Resolve** | database and project directory | projects, render history | local read |
| **Claude / ChatGPT** | local config and history directories | past usage, so the Hub starts out knowing how you work | local read |
| **Epic / GOG / Battle.net** | manifest files | library, same as Steam | local read |
| **Xbox / PlayStation** | — | playtime, achievements | OAuth |
| **Discord** | install path | Nitro cost only | ask once |
| **Google / Microsoft** | — | calendar (**done**), Drive or OneDrive usage and storage tier | OAuth |
| **Netflix, Showmax, DStv, Prime** | — | no API: **cost and who uses it**, entered once | ask once |
| **Browsers** | profile directories | bookmarks, most-visited — opt-in, sensitive | local read |

Three permission classes, in increasing order of what they ask of you:

1. **Local read** — the Hub reads files already on your disk. No accounts, no network. This is the ChatGPT-found-your-Claude trick, and most of the list lives here.
2. **Official API** — OAuth against the real service. Requires registering a developer app once per service, with the callback pointed at the Hub.
3. **Cost only** — no data available, so the Hub simply records that the household pays for it, and who uses it.

**What we will not build:** storing streaming or banking passwords and logging in as you. Official APIs or nothing. A household record system that hoards credentials is a liability, not an asset.

---

## Layer 3 — What it unlocks

This is the point. With registry plus census, the Hub answers things nobody can currently answer without an afternoon of digging:

- **What does this house actually spend?** Every subscription across every person, including the ones nobody remembers agreeing to.
- **What are we wasting?** Two music services. A family plan with three of six seats used. A debit order for someone who moved out.
- **What's about to bite us?** Warranty expiring, contract renewing at a worse rate, licence disc due, insurance escalating.
- **Can we do the thing?** "Can two people stream 4K while I upload?" — answerable from the ISP package, the access point's real capability, and who is currently on.
- **Who do I call, and what did they do last time?**
- **Debt order** — which balance to attack first, and what the interest costs per month.
- **And for the AI:** The Sauce stops guessing. It knows the house owns a Ryzen 5 9600X with an RX 9070 in the studio, that the fibre is capped, that the rates come off on the 3rd, and that the geyser was fixed in March by a man named in the contacts table.

---

## Order of build

1. **Registry schema and admin pages** — the spine everything hangs off.
2. **Network discovery seeds the kit** — the LAN scan already finds about fourteen devices; arrive pre-filled and let Tao name them.
3. **Census in the installer** — the integration catalogue, detection, and per-app offers.
4. **Local-read integrations first** — Steam, Blender, Resolve, Claude, the launchers. No OAuth, immediate value.
5. **Cost-only entries** — the subscription ledger fills out fast, and that is where the money insight comes from.
6. **OAuth integrations** — Spotify first, since it returns the subscription tier as well as the listening data.
7. **Insight layer** — spend, duplicates, unused, expiring.
8. **Wire The Sauce to the whole model**, replacing the hand-assembled snippet it gets today.

## Non-negotiables

- LAN-only, behind the admin key. The off-network guard must cover every `/api/house/*` route.
- **Never in git.** The repo is public.
- Account numbers stored as last-four references only.
- Per-person visibility: Dad's debt is not Tao's Spotify. The `privacy` model already on accounts extends here.
- What reaches an AI prompt is aggregates and labels, never identifiers.
