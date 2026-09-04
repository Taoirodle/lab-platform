# L.A.B Hub — the native app

The **personal** L.A.B experience as a real, compiled desktop application. Not a PWA. Not Electron. A **Tauri** app: a Rust binary that renders the modular web front-end in the OS's own webview → a ~5 MB `.exe` / `.app` / `.AppImage` / `.deb`.

The **web** Hub (served from the server at `/hub`) is the *shared family surface*. **This** is the personal one, custom-built per machine.

## Why Tauri (not Electron / not PWA)

| | Electron | PWA | **Tauri (this)** |
|---|---|---|---|
| Real executable | yes (~150 MB) | no | **yes (~5 MB)** |
| Bundles Chromium | yes | — | **no (OS webview)** |
| Native OS access (specs, disks) | yes | limited | **yes (Rust)** |
| Cross-platform installers | yes | — | **yes** |

## Structure (fully modular)

```
lab-hub-app/
  src/                 the front-end (web tech, runs in the native webview)
    index.html         shell — loads app.js, pages.js, then every module
    app.js             core: page registry + router + native bridge + looks
    pages.js           icons/helpers + The Sauce, Automations, Device pages
    modules/           one file per feature, each registers itself:
      telemetry.js  charts.js  stats.js  widgets.js  dashboard.js
      calendar.js  profile.js  appstore.js  foryou.js  settings.js
    config.js  styles.css
  src-tauri/           the native shell (Rust)
    Cargo.toml  tauri.conf.json (withGlobalTauri!)  build.rs
    src/lib.rs         native commands: device_info, quick_load, usage_snapshot,
                       game_library, recent_files, profile_hint, autostart_*, save_to_downloads
    capabilities/  icons/
```

**Adding a page = registering one module object** in its own file under `modules/`:
```js
LAB.register({ id:'notes', label:'Notes', icon:'<svg…>', order:11, render(el, ctx){ … } });
```
Nothing else changes — the sidebar and router build themselves from the registry. Registering an existing `id` replaces it. Pages can gate on the user's archetype via `show(ctx)` and rename via `dynLabel(ctx)` (the "Stats" tab becomes "Game stats" / "Creativity stats" automatically). Widgets work the same way (`LAB.widgets.register`). Full architecture, the telemetry privacy model, calendar feeds and the release steps: `../docs/13-hub-app.md`.

## Build it

Prereqs: [Rust](https://rustup.rs), Node 20, and the Tauri OS deps for your platform (Windows: MSVC build tools + WebView2; macOS: Xcode CLT; Linux: `libwebkit2gtk-4.1-dev`).

```bash
cd lab-hub-app
npm install
npm run dev      # hot-reload dev window
npm run build    # -> src-tauri/target/release/bundle/  (your installer)
```

Point it at a server other than the LAN default:
```bash
LAB_SERVER="https://lab.yourdomain.com" npm run dev
```

## The three OSes (and the honest bit about Mac)

- **Windows + Linux** build on any machine with the toolchain — including in CI.
- **macOS cannot be built off the Linux server** (Apple requires a Mac to build/sign `.app`/`.dmg`). Use the included **GitHub Actions** workflow (`.github/workflows/build-app.yml`) — free macOS runners build all three, plus Windows and Linux, in one go. Download the artifacts, drop them into `lab-hub-manager/app-builds/`, and the server's *Get the App* page serves real downloads instead of the setup wizard.
- Per-user personalization is **not** a per-user recompile: one signed binary per OS + the wizard's profile, which the app pulls on first run (`/api/wizard/profile/:id`).

## Icons

`src-tauri/icons/` needs `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`. Generate them from the master mark in one command: `npx @tauri-apps/cli icon ../lab-hub-manager/hub/icons/icon-512.png`.

## License

GPL-3.0-or-later. See `../LICENSE`.
