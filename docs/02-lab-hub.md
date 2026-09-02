# 02 — Home L.A.B Hub  (App #1 — the client dashboard)

**What it is:** a self-adapting home-screen replacement — "Home Assistant that grows as you
use it." A *personal dashboard*, one per family member, **packaged, hosted and distributed
from the Main Server**. It is a **client**: it reports up to the Manager and receives
updates, apps and policies down.

## What changes from today's build

Today's `home-lab-hub` (A-000004 live) already nails most of the Hub itself. The corrections:

- **Remove the management brain from the Hub.** The A-000005 "Lab HQ" tab (dev team, fleet,
  proposals, boss console) **moves to the Manager**. The Hub stops trying to be the boss.
- **Become truly self-adapting.** The Hub iterates its own layout/UX based on the owner's
  usage — but the *heavy* thinking (building updates/apps) happens on the server and is
  delivered down. The Hub applies what the Manager ships.
- **Real installer.** Not "an Electron on my PC with a LAN host" — a proper packaged
  installer delivered from the server's LAN install page, tied to a **user account**.

## Navigation (the fries button)

Floating, undocked **fries-style button**, top-left, freely draggable. Hover → all tabs
cascade; hover a tab → its ~5 sub-tabs cascade. Click a main tab → its overview.
Main tabs are numbered; sub-tabs are `.`-indexed.

1. **Home / Overview** — The Sauce (AI), Main Dashboard, Today, Notes, Activity
2. **System** — Overview, **[PC name] Health (EVERYTHING about PC health)**, Windows
   Manager, Displays, Storage, System Manager, Task Manager, WiFi
3. **Desk** — Installed Apps, Office, **Game Centre** (near full-app takeover), Quick Launch, more
4. **Rooms** — add rooms → 2D/3D smart-home builder (furniture, plugs, PCs, CCTV)
5. **Control Center** — automations, scenes, schedules
6. **Widgets** — build/create widgets
7. **Passwords & Security** — password-protected vault
8. **Devices** — connect PCs, phones, smart devices for control
9. **App Store** — server-built apps on demand (see below)
10. **Settings**

## The Sauce (AI assistant)

- First open → setup: what it calls you, a **voice**, a **personality**, **permissions**.
- Then a boot animation with **real rendered 3D geometry + 2D/3D particles that react when
  it speaks**.
- **Voice:** hardcoded voice-model API for now → later an **open-source voice model wired
  directly to Claude's CLI** once the hardware is in place.
- On a client, the Sauce is the friendly face; its deeper actions route through the Manager.

## Rooms

Click **Add new room** → it adds a room and opens setup. Place furniture, plugs, computers,
CCTV, etc. and see it as a **fully customisable 2D and 3D render**. This is the on-ramp to
full smart-home control.

## App Store (client side)

The client shows **previews** with sizes and build-time estimates (both **computed on the
server**, never fabricated on the client). Click **Download** → the client asks the Manager
to **build that app**; the user just sees a progress bar; when done, a **real packaged app**
is installed on their PC. The thousands of possible apps are never pre-built — they're built
on demand by the server-side Dev Team.

## Non-negotiables

- Everything a real app has: proper installer, updates, settings, about, help, keyboard
  shortcuts, QOL touches, graceful offline behaviour.
- Self-hosted, no cloud accounts, runs inside the home.
