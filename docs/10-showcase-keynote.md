# 10 · The Showcase — "L.A.B ONE" (the living-room keynote)

The family pitch isn't a slideshow — **the house itself is the demo.** Tao's brief: Jensen-Huang-walks-out-with-the-Spark energy, in the living room, ending with the whole family onboarded. This is the run-of-show, the hardware list, and what gets pre-built.

## The concept

Family sits down for "a presentation." What they don't know: the room is already wired. The TV, the lights, the kiosk, and a motion sensor are all quietly on the L.A.B — and the show *is* the platform running live. Every trick is real; nothing staged.

## Run of show (~12 minutes)

| # | Cue | What happens | What sells it |
|---|-----|-------------|----------------|
| 0 | **Blackout** | Lights dim *themselves*. TV wakes to the rotating L.A.B cube. Silence. | The room moved and nobody touched anything |
| 1 | **Cold open** | TV: "Good evening, Volkwyns." — The Sauce greets each person **by name**, one by one; lights pulse warm with each name | It knows the family |
| 2 | **The artifact** | Tao walks out holding the **USB admin key** (the Jensen moment — small object, big line): "This is the key to our house." | Physical prop = physical security |
| 3 | **Motion reveal** | Someone's sent to the hallway on a pretext → PIR fires → lights snap on + TV flashes **MOTION · HALLWAY** over the live neural map | The house *notices* |
| 4 | **Guardian demo** | Kinect depth-feed goes up on the TV — live silhouettes, "GUARDIAN · PERIMETER ACTIVE." Family waves, sees themselves as a security system | Sci-fi, but it's their lounge |
| 5 | **The Sauce, live** | Tao asks out loud (types on kiosk): *"Sauce — movie-night the room and plan our week."* Lights dim to warm low, TV shows the generated plan | AI that **does**, not chats |
| 6 | **The money slide** | TV: subscriptions counter — photos→**Vault**, cloud storage→**Vault**, chore/list apps→**Family Board**, ad-blocking→**Guardian/Pi-hole**, home-cam subs→**Kinect**. Running total of R/month clawed back | The "why invest" in one number |
| 7 | **Onboarding ceremony** | Each person creates their account on the kiosk/phone. As each joins, TV announces "**Mom has joined the L.A.B**" + lights do a colour sweep per person | They're not watching a product — they're joining it |
| 8 | **Curtain call** | Everyone's name on the TV, family photo drops into Vault live, lights do a slow wave, cube spins out | Standing ovation from at least one parent |

## Hardware shopping list (gather, then we build)

| Item | What to get | ~Cost | Notes |
|---|---|---|---|
| **Smart LED strip** | WS2812B strip + **ESP32 running WLED** (or a pre-flashed WLED strip) | cheap | WLED has a clean local REST/UDP API — the Manager can drive real light *choreography*, not just on/off. This becomes Rooms' first REAL device |
| **Smart bulbs ×1-2** | WiZ or Tuya WiFi bulbs (local-control capable) | cheap | Lounge lamp + hallway |
| **Motion detector** | Ready-made Tuya WiFi PIR **or** ESP32 + HC-SR501 (we flash it ourselves, ~R100 in parts) | tiny | DIY version literally just POSTs to `/api/events` `type:motion` — it's a 20-line firmware |
| **Kinect** | ✅ already owned | R0 | Kinect v1 → libfreenect; **Kinect v2 needs the PC USB adapter** — check which one you have. Runs on a helper PC (Twizzler) that bridges depth frames to the Manager |
| **Kiosk** | ✅ iPad | R0 | Safari fullscreen → `/kiosk` |
| **TV** | Xbox's Edge browser → the showcase page fullscreen | R0 | Poetic: the Kinect's own console runs the show |
| **The prop** | ✅ USB admin key | R0 | The Jensen artifact |

## What I pre-build (before hardware even arrives)

1. **`/showcase`** — a TV-facing choreography page: cue-driven scenes (cube intro → greetings → motion alert → Guardian view → money slide → join ceremony), advanced by Tao from his phone via a hidden `/showcase/control` remote. WebSocket-pushed, so cues are instant.
2. **Choreography engine in the Manager** — a cue fires: TV scene + light commands (WLED/WiZ) + kiosk state, all in sync. This is just Rooms growing real actuators — showcase code *is* production code.
3. **Motion ingestion** — `type:motion` events → kiosk ledger + live TV interrupt. The ESP32 firmware sketch ready to flash.
4. **Guardian/Kinect bridge spec** — helper agent on Twizzler: libfreenect → downscaled depth frames → WebSocket → TV page. Branded as the Guardian app's first real feature.
5. **Join-ceremony broadcast** — account-creation events already exist; the TV page just subscribes and celebrates.
6. **Money slide** — pulls real numbers Tao enters once (current subscription list) and renders the counter.

## Decisions logged this session

- **Camera / 3D room mapping: GO** (Tao 2026-09-01). Kinect depth data + snapshots may be used for room mapping + Guardian. Mapping pipeline lands after the Kinect bridge exists.
- **Live internet sourcing: gated behind egress controls** — see below.

## Internet sourcing — the firewall answer

It's not about elevated router access (that's only needed later for Pi-hole DNS telemetry). Research-agent web access is **outbound**, so the safe pattern is an **egress allowlist**, not a bigger door:

- **Phase 1 (build first):** a filtering proxy on the server (squid/tinyproxy) with a **domain allowlist** (GitHub, official docs, package registries, chosen news/RSS). Research agents get internet *only* through it; every fetch is logged to the audit trail; nftables pins the agent user so it can't bypass the proxy. User data never leaves — agents pull *in*, nothing personal goes *out*.
- **Phase 2:** Pi-hole as the network's DNS (already on the roadmap) = network-wide visibility + blocklists, and it doubles as the Dev Team's DNS telemetry source.
- **Phase 3 (optional, later):** a dedicated OPNsense box between router and LAN if the L.A.B ever hosts for people outside the family. Overkill today.
