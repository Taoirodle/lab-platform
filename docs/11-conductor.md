# 11 · The Conductor — L.A.B's native device engine

**Decision (Tao, 2026-09-01):** no third-party smart-home platform is ever user-visible in the L.A.B. We wanted Home Assistant's *functionality* without being Home Assistant — so we built our own engine. Concepts aren't copyrightable; the good ideas of the genre (entities, state store, event bus, drivers, scenes, automations) are reimplemented from scratch as L.A.B architecture in `conductor.js`. Zero borrowed code, zero third-party branding, fully ours.

## Architecture

```
            Hub / Kiosk / Sauce / Showcase / Admin
                          │  (one API)
                    ┌─────▼─────┐
                    │ CONDUCTOR │  entities · scenes · automations
                    │  (engine)  │  event bus · SQL state · ledger feed
                    └─────┬─────┘
        ┌───────────┬─────┴─────┬────────────┐
      wled        wiz         push        virtual
   (HTTP JSON)  (UDP 38899) (ESP32→us)  (demo/test)
```

- **Entities** — every device the house knows: id, kind (light / led-strip / motion / sensor / camera), room, driver, address, live `state` JSONB, online flag. SQL-backed.
- **Drivers** — tiny protocol adapters (~30 lines each): `probe()` + `apply(cmd)`. Commands are normalized: `{on, toggle, bri 0-255, color [r,g,b], temp, effect}`.
- **Scenes** — named looks (`movie-night`, `all-off`) = a list of entity commands. These are the showcase's choreography primitives.
- **Automations** — trigger `{type: motion|state, room?, entity?}` → actions (commands or a scene). Fire on the in-process event bus; a failing automation can never crash the engine.
- **Ingest** — our own ESP32 sensors POST to `/api/ingest/:token`; firmware at `hardware/lab-motion-sensor/lab-motion-sensor.ino` (no cloud, no app, just our server).
- **Telemetry** — every state change → events firehose + kiosk/client ledgers. The Dev Team's first real-world signal.

## Why not Home Assistant (even hidden)

For the hardware we actually own/plan (WLED, WiZ, our ESP32s, Kinect) we need ~4 drivers, not 2,000 integrations. Native wins on: identity (all ours), footprint (the G50 has 8GB RAM), ledger integration (state changes are *born* in our telemetry), and AI extensibility — a future `driver` artifact kind lets the build team write + stub-test new protocol drivers autonomously (plan filed in the team ledger). Wrapping OSS stays a last-resort for exotic gear, invisible if ever used — per the team-ledger guardrail `own-engine`.

## Verified working (M-000014)

- Kiosk rooms migrated into engine entities (same API shape; toggles are real engine commands now).
- `movie-night` scene sets warm amber at 60 brightness. ✔
- **Full automation chain**: created a push motion sensor → automation `hall-motion-lights` → simulated ESP32 POST → Living Room turned itself on. The showcase's motion-reveal moment, working before any hardware exists. ✔
- **Protocol proof**: stub WLED (HTTP) and stub WiZ (UDP) devices received byte-perfect commands from the drivers (`{"on":true,"bri":180,"seg":[{"col":[[255,140,60]]}]}` / `{"method":"setPilot","params":{"state":true,"dimming":78,"temp":2700}}`), and `probe` detected both online. Real hardware = register IP, done. ✔

## API

`GET/POST /api/conductor/entities` · `DELETE /api/conductor/entities/:id` · `POST /api/conductor/entities/:id/command` · `GET /api/conductor/probe` · `GET/POST /api/conductor/scenes` (+`/:id/run`) · `GET/POST /api/conductor/automations` · `POST /api/ingest/:token`

## Next

- **WLED strip + WiZ bulbs arrive** → register real IPs, showcase choreography drives them via scenes.
- **`driver` artifact kind** for the AI team (Tasmota, Zigbee-via-coordinator, ONVIF cameras).
- **Kinect bridge** feeds a `camera` entity (Guardian).
- Rooms app UI grows device-level controls (dimmer, colour) on top of the engine.
