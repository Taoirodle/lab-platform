# 08 · Design Language — making L.A.B not look "Aiey"

Your note: the early UI looked *"super Aiey."* This is the fix — what "Aiey" actually means, the real products L.A.B is designed off, and the two distinct design systems now in place.

## What makes a UI read as "AI-generated"

The tells, and how L.A.B avoids each:

| The "Aiey" tell | What L.A.B does instead |
|---|---|
| Purple-blue gradient on everything, glowing everywhere | Gradients are **rare and purposeful** — the Hub's one warm corner glow, a room "on" state. The Manager/Admin are flat white/silver. |
| Emoji as icons (🚀📊✨) | **Zero emoji.** Every icon is a hand-drawn, single-stroke SVG on a consistent 32×32 grid. |
| Everything in rounded pill-cards, evenly spaced, centred | Corporate surfaces are **blocky and square** (1px borders, sharp corners). Hierarchy comes from weight and spacing, not decoration. |
| Generic "Lorem-ish" copy, exclamation marks, "Empower your…" | Terse, specific, human copy. "Nothing awaiting approval." not "You're all caught up! 🎉" |
| One flat visual style with no point of view | **Two deliberate design systems** (below), each committed to a mood. |
| Fake depth — drop shadows on everything | Depth is used once per view at most; mostly flat with hairline borders. |
| Charts that are obviously a library default | Custom SVG charts drawn to the data, tuned to the palette, animated on entry. |

## Reference products L.A.B is designed off

- **Linear** — the terse, high-contrast, keyboard-serious feel of the Manager and Admin Portal. Hairline borders, tabular numbers, restraint.
- **Vercel / Geist** — black-on-white, blocky cards, monospace for machine data (tokens, paths, versions).
- **Stripe Dashboard** — how to make dense data (the analytics graphs, the ship-activity chart) feel calm and legible.
- **Raycast** — the "quiet tool that respects you" tone; the significance/approval model's minimalism.
- **Things / Arc** — the *warm* side: the Hub and Kiosk borrow their soft depth, generous type, and personality without getting cute.

## The two design systems (deliberately different)

L.A.B is not one app — so it isn't one look. The split is intentional and consistent.

### 1. Control surfaces — Manager, Admin Portal, Installer
Corporate, precise, "this runs infrastructure."
- Palette: `#e8eaee` ground, white surfaces, `#1b2330` ink, `#2f5fd0` steel accent, silver `#bcc3cf` lines.
- Square corners, 1px borders, `Segoe UI`, **tabular numbers**, monospace for tokens/paths.
- No emoji, no gradients (except a single data-driven glow on the Admin hero).
- Motion is functional: count-ups, grow-in bars — never decorative bounce.

### 2. Personal surfaces — Hub, Kiosk
Warm, calm, "this is yours."
- Palette: `#0a0c14` near-black, glass panels, `#b79bff`→`#6fb4ff` accent, warm `#ffcf6f` for the Kiosk's lights.
- Rounded (18–22px), soft glow, generous type, one ambient background gradient.
- Personality in copy ("Good morning, Tao"), never in clutter.

The rule: **a family member should never mistake the Hub for the Manager, and an admin should never mistake the Admin Portal for a consumer app.** Same brand mark (the cube-in-cube), two different worlds.

## Where it's applied (Beta 1.0)

- **App Store** — real store chrome: category chips, a featured hero, per-app generated preview "screenshots," monospace version/size, install counts. Modeled on the App Store / Vercel marketplace, not a grid of emoji.
- **Admin analytics** — bespoke SVG ship-activity + significance charts with the 8+ approval band called out in red; count-up stat tiles. Stripe-dashboard calm, not Chart.js default.
- **Local Web Installer** — a numbered corporate stepper; security-key step with a real warning, not a cheerful wizard.
- **Kiosk** — an ambient wall display: one giant clock, warm light tiles that actually glow when on. Designed to be read across a room, not a phone screen scaled up.

## The shared brand

- **Mark:** the cube-in-cube (a nested square with corner ties) — one geometric idea, drawn once, reused at every scale.
- **Loader:** the same mark as a rotating wireframe cube (`labloader.js`) is the loading screen for every L.A.B app.
