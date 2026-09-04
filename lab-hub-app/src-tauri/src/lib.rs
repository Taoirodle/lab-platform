// ============================================================
//  L.A.B Hub — native shell (Tauri v2). A real compiled executable, not
//  Electron, not a PWA. The UI is the modular web front-end in ../src; Rust
//  provides the native commands the web layer can't do on its own:
//    device_info     — what this machine is (static probe)
//    quick_load      — cpu / ram / uptime, cheap enough to poll for live tiles
//    usage_snapshot  — what's in front of you, top processes, idle time
//                      (the engine behind the Stats page)
//    server_url      — which L.A.B server this app talks to
// ============================================================
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use sysinfo::{Disks, Pid, ProcessesToUpdate, System};

// ---------------------------------------------------------------- device probe
#[derive(Serialize)]
struct DeviceInfo {
    hostname: String,
    os: String,
    os_version: String,
    arch: String,
    cpu: String,
    cpu_cores: usize,
    ram_gb: u64,
    disks: Vec<DiskInfo>,
    app_version: String,
}

#[derive(Serialize)]
struct DiskInfo {
    name: String,
    total_gb: u64,
    free_gb: u64,
}

/// Native device probe — powers the "Device" page + the personalization on
/// first run. This is the kind of thing a PWA/browser simply cannot read.
#[tauri::command]
fn device_info() -> DeviceInfo {
    let mut sys = System::new_all();
    sys.refresh_all();
    let cpu = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|d| DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            total_gb: d.total_space() / 1_073_741_824,
            free_gb: d.available_space() / 1_073_741_824,
        })
        .collect();
    DeviceInfo {
        hostname: System::host_name().unwrap_or_default(),
        os: System::name().unwrap_or_default(),
        os_version: System::os_version().unwrap_or_default(),
        arch: std::env::consts::ARCH.to_string(),
        cpu,
        cpu_cores: sys.cpus().len(),
        ram_gb: sys.total_memory() / 1_073_741_824,
        disks,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// Which L.A.B server this app talks to (overridable via env at launch).
#[tauri::command]
fn server_url() -> String {
    std::env::var("LAB_SERVER").unwrap_or_else(|_| "http://192.168.1.115:8090".to_string())
}

/// Where the install wizard leaves its note for the app.
fn profile_path() -> Option<std::path::PathBuf> {
    use std::path::PathBuf;
    #[cfg(windows)]
    return std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join("LAB").join("profile.json"));
    #[cfg(target_os = "macos")]
    return std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library").join("Application Support").join("LAB").join("profile.json"));
    #[cfg(all(unix, not(target_os = "macos")))]
    return std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config").join("lab").join("profile.json"));
    #[allow(unreachable_code)]
    None
}

/// The install wizard writes {id, account_id, account_name, server, …} to disk
/// after it analyses the PC, so the app is personalised — and signed in — from
/// its very first launch. Returns {found:false} when there is no note.
#[tauri::command]
fn profile_hint() -> serde_json::Value {
    let Some(p) = profile_path() else { return serde_json::json!({ "found": false }) };
    match std::fs::read_to_string(&p).ok().and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()) {
        Some(mut v) => {
            if let Some(o) = v.as_object_mut() {
                o.insert("found".into(), serde_json::Value::Bool(true));
                o.insert("path".into(), serde_json::Value::String(p.to_string_lossy().to_string()));
            }
            v
        }
        None => serde_json::json!({ "found": false, "path": p.to_string_lossy() }),
    }
}

// ---------------------------------------------------------------- live telemetry
/// One long-lived `System` so CPU percentages are real deltas between calls
/// (sysinfo needs two refreshes to compute usage — we keep the first one).
pub struct Telemetry(pub Mutex<System>);

#[derive(Serialize)]
struct QuickLoad {
    cpu: f32,
    mem_used_mb: u64,
    mem_total_mb: u64,
    uptime_s: u64,
}

#[derive(Serialize)]
struct ProcInfo {
    name: String,
    cpu: f32,
    mem_mb: u64,
    category: &'static str,
}

#[derive(Serialize)]
struct Foreground {
    pid: u32,
    name: String,
    title: String,
    category: &'static str,
}

#[derive(Serialize)]
struct Snapshot {
    ts: u64,
    cpu: f32,
    mem_used_mb: u64,
    mem_total_mb: u64,
    uptime_s: u64,
    /// seconds since the last key/mouse input (None where we can't read it yet)
    idle_s: Option<u64>,
    foreground: Option<Foreground>,
    top: Vec<ProcInfo>,
    supports_foreground: bool,
}

/// Anything running out of these folders is a game, whatever it's called.
const GAME_DIRS: &[&str] = &[
    "steamapps\\common", "steamapps/common", "epic games", "riot games", "gog galaxy\\games",
    "xboxgames", "battle.net", "ubisoft game launcher\\games", "ea games", "origin games",
    "rockstar games", "\\games\\", "/games/",
];

/// Process name → kind. Exact matches first, then multi-word prefixes
/// ("adobe premiere pro" matches "adobe premiere pro (beta)"). Extend freely.
const CATALOG: &[(&str, &[&str])] = &[
    ("Gaming", &[
        "steam", "steamwebhelper", "epicgameslauncher", "riotclientservices", "leagueclient", "valorant", "battle.net", "galaxyclient",
        "gog galaxy", "ubisoftconnect", "upc", "eadesktop", "origin", "minecraft", "minecraftlauncher", "javaw", "robloxplayerbeta",
        "roblox", "fortniteclient-win64-shipping", "cs2", "csgo", "dota2", "rocketleague", "gta5", "gtav", "r5apex", "overwatch",
        "valheim", "eldenring", "cyberpunk2077", "witcher3", "rdr2", "hl2", "portal2", "terraria", "stardew valley", "factorio",
        "rust", "rustclient", "tslgame", "warframe", "destiny2", "genshinimpact", "starrail", "wutheringwaves", "osu!", "osu",
        "hogwartslegacy", "palworld-win64-shipping", "helldivers2", "bf2042", "fifa", "fc25", "fc26", "nba2k25", "forzahorizon5",
    ]),
    ("Creativity", &[
        "photoshop", "illustrator", "indesign", "adobe premiere pro", "premiere pro", "afterfx", "lightroom", "adobe audition",
        "audition", "animate", "adobe media encoder", "blender", "figma", "resolve", "davinci resolve", "audacity", "fl64",
        "fl studio", "ableton live", "reaper", "obs64", "obs", "krita", "gimp", "gimp-2.10", "inkscape", "unity", "unity hub",
        "unrealengine", "unrealeditor", "godot", "clipstudiopaint", "affinity photo", "affinity designer", "affinity publisher",
        "photo", "designer", "publisher", "capcut", "canva", "paintdotnet", "aseprite", "substance painter", "zbrush", "maya",
        "3dsmax", "cinema 4d", "houdini", "fusion360", "sketchup", "autocad", "solidworks", "cakewalk", "studio one", "cubase",
        "pro tools", "bitwig studio", "logicpro", "final cut pro", "kdenlive", "shotcut", "lightburn", "prusaslicer", "bambustudio",
    ]),
    ("Comms", &[
        "discord", "teams", "ms-teams", "slack", "zoom", "whatsapp", "telegram", "signal", "messenger", "skype", "webex", "element",
        "facetime", "messages",
    ]),
    ("Browsing", &[
        "chrome", "msedge", "firefox", "brave", "opera", "opera_gx", "vivaldi", "arc", "zen", "chromium", "librewolf", "waterfox",
        "tor browser", "iexplore", "safari",
    ]),
    ("Work", &[
        "code", "code - insiders", "cursor", "windsurf", "devenv", "rider64", "idea64", "pycharm64", "webstorm64", "clion64",
        "goland64", "datagrip64", "phpstorm64", "rubymine64", "studio64", "windowsterminal", "wt", "powershell", "pwsh", "cmd",
        "wsl", "wslhost", "bash", "git", "gitkraken", "github desktop", "githubdesktop", "node", "python", "python3", "cargo",
        "rustc", "rust-analyzer", "docker desktop", "docker", "postman", "insomnia", "notepad++", "sublime_text", "vim", "nvim",
        "emacs", "claude", "winword", "excel", "powerpnt", "onenote", "outlook", "olk", "msaccess", "visio", "winproj", "notion",
        "obsidian", "acrobat", "acrord32", "onedrive", "libreoffice", "soffice", "soffice.bin", "wordpad", "notepad", "calculator",
        "sap", "quickbooks", "ssms", "pgadmin4", "dbeaver", "mongodbcompass", "tableau", "pbidesktop", "rstudio", "matlab",
        "jupyter", "anki", "todoist", "trello", "linear", "asana", "clickup", "evernote", "logseq", "typora", "zotero", "mendeley",
        "putty", "mobaxterm", "termius", "filezilla", "winscp", "virtualbox", "vmware", "vmware-vmx", "vmconnect", "mstsc",
        "anydesk", "teamviewer", "parsec", "tailscale", "tailscale-ipn", "1password", "bitwarden", "keepassxc", "terminal",
        "iterm2", "xcode", "android studio", "finder",
    ]),
    ("Entertainment", &[
        "spotify", "vlc", "mpc-hc64", "mpc-be64", "potplayermini64", "netflix", "primevideo", "disney+", "musicbee", "itunes",
        "applemusic", "amazon music", "tidal", "deezer", "foobar2000", "winamp", "plex", "plexmediaplayer", "jellyfin", "kodi",
        "stremio", "twitch", "crunchyroll", "youtube", "youtube music", "mpv", "wmplayer", "groove", "microsoft.media.player",
        "music", "tv", "photos",
    ]),
    ("System", &[
        "explorer", "dwm", "svchost", "searchhost", "searchapp", "startmenuexperiencehost", "shellexperiencehost", "textinputhost",
        "runtimebroker", "sihost", "taskhostw", "ctfmon", "lockapp", "applicationframehost", "systemsettings", "taskmgr", "msmpeng",
        "securityhealthsystray", "nvcontainer", "nvdisplay.container", "nvidia share", "nvidia app", "rtkauduservice64", "lsass",
        "csrss", "wininit", "winlogon", "services", "smss", "system", "registry", "memory compression", "fontdrvhost", "dllhost",
        "conhost", "wmiprvse", "spoolsv", "audiodg", "dashost", "backgroundtaskhost", "settingsynchost", "phoneexperiencehost",
        "widgets", "widgetservice", "msedgewebview2", "webviewhost", "signalrgb", "icue", "lghub", "lghub_agent", "armourycrate",
        "razer synapse", "steelseriesgg", "lab-hub", "l.a.b hub", "windowsdefender", "wudfhost", "crashpad_handler", "gamebar",
        "gamebarftserver", "gamingservices", "gamingservicesnet", "xboxpcapp", "xboxappservices", "kernel_task", "windowserver",
        "loginwindow", "launchd", "systemd", "gnome-shell", "plasmashell", "kwin_x11", "kwin_wayland", "xorg",
    ]),
];

fn clean_name(raw: &str) -> String {
    let lower = raw.trim().to_lowercase();
    lower.strip_suffix(".exe").map(|s| s.to_string()).unwrap_or(lower)
}

fn classify(name: &str, exe: Option<&std::path::Path>) -> &'static str {
    if let Some(p) = exe {
        let ps = p.to_string_lossy().to_lowercase();
        if GAME_DIRS.iter().any(|d| ps.contains(d)) {
            return "Gaming";
        }
    }
    for (cat, names) in CATALOG.iter() {
        if names.iter().any(|n| *n == name) {
            return cat;
        }
    }
    for (cat, names) in CATALOG.iter() {
        if names.iter().any(|n| n.contains(' ') && name.starts_with(n)) {
            return cat;
        }
    }
    "Other"
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(windows)]
mod win {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};

    /// (pid, window title) of whatever has focus right now.
    pub fn foreground() -> Option<(u32, String)> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 {
                return None;
            }
            let mut buf = [0u16; 512];
            let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            let title = if n > 0 { String::from_utf16_lossy(&buf[..n as usize]) } else { String::new() };
            Some((pid, title))
        }
    }

    /// Seconds since the last keyboard/mouse input.
    pub fn idle_seconds() -> Option<u64> {
        unsafe {
            let mut lii = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
            if GetLastInputInfo(&mut lii) == 0 {
                return None;
            }
            Some((GetTickCount().wrapping_sub(lii.dwTime) / 1000) as u64)
        }
    }
}

#[derive(Serialize)]
struct LiveDisk {
    name: String,
    mount: String,
    fs: String,
    total: u64,
    free: u64,
    removable: bool,
}

#[derive(Serialize)]
struct LiveNet {
    name: String,
    mac: String,
    rx_total: u64,
    tx_total: u64,
}

#[derive(Serialize)]
struct LiveDevice {
    disks: Vec<LiveDisk>,
    networks: Vec<LiveNet>,
}

/// Storage + network interfaces, fresh each call (the Device page polls it).
#[tauri::command]
fn live_device() -> LiveDevice {
    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|d| LiveDisk {
            name: d.name().to_string_lossy().to_string(),
            mount: d.mount_point().to_string_lossy().to_string(),
            fs: d.file_system().to_string_lossy().to_string(),
            total: d.total_space(),
            free: d.available_space(),
            removable: d.is_removable(),
        })
        .collect();
    let nets = sysinfo::Networks::new_with_refreshed_list();
    let networks = nets
        .iter()
        .map(|(name, n)| LiveNet { name: name.clone(), mac: n.mac_address().to_string(), rx_total: n.total_received(), tx_total: n.total_transmitted() })
        .collect();
    LiveDevice { disks, networks }
}

/// Cheap: CPU + RAM + uptime. Safe to poll every few seconds for a live tile.
#[tauri::command]
fn quick_load(state: tauri::State<'_, Telemetry>) -> QuickLoad {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    QuickLoad {
        cpu: (sys.global_cpu_usage() * 10.0).round() / 10.0,
        mem_used_mb: sys.used_memory() / 1_048_576,
        mem_total_mb: sys.total_memory() / 1_048_576,
        uptime_s: System::uptime(),
    }
}

/// The Stats engine: what's in front, the busiest processes (merged by name —
/// a browser is one thing, not forty helper processes), and how long you've
/// been away from the keyboard. Called once a minute by the sampler.
#[tauri::command]
fn usage_snapshot(state: tauri::State<'_, Telemetry>) -> Snapshot {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let cores = sys.cpus().len().max(1) as f32;

    let mut agg: HashMap<String, (f32, u64, &'static str)> = HashMap::new();
    for p in sys.processes().values() {
        let name = clean_name(&p.name().to_string_lossy());
        if name.is_empty() {
            continue;
        }
        let cat = classify(&name, p.exe());
        let e = agg.entry(name).or_insert((0.0, 0, cat));
        e.0 += p.cpu_usage() / cores;
        e.1 += p.memory() / 1_048_576;
    }
    let mut top: Vec<ProcInfo> = agg
        .into_iter()
        .map(|(name, (cpu, mem_mb, category))| ProcInfo { name, cpu: (cpu * 10.0).round() / 10.0, mem_mb, category })
        .collect();
    top.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal).then(b.mem_mb.cmp(&a.mem_mb)));
    top.truncate(12);

    #[cfg(windows)]
    let fg = win::foreground();
    #[cfg(not(windows))]
    let fg: Option<(u32, String)> = None;
    let foreground = fg.and_then(|(pid, title)| {
        sys.process(Pid::from_u32(pid)).map(|p| {
            let name = clean_name(&p.name().to_string_lossy());
            let category = classify(&name, p.exe());
            Foreground { pid, name, title, category }
        })
    });

    #[cfg(windows)]
    let idle_s = win::idle_seconds();
    #[cfg(not(windows))]
    let idle_s: Option<u64> = None;

    Snapshot {
        ts: now_secs(),
        cpu: (sys.global_cpu_usage() * 10.0).round() / 10.0,
        mem_used_mb: sys.used_memory() / 1_048_576,
        mem_total_mb: sys.total_memory() / 1_048_576,
        uptime_s: System::uptime(),
        idle_s,
        foreground,
        top,
        supports_foreground: cfg!(windows),
    }
}

// ---------------------------------------------------------------- "For you": library + recent files
#[derive(Serialize)]
struct Game {
    name: String,
    source: &'static str,
    app_id: String,
    size_gb: f32,
    install_dir: String,
    last_played: u64,
}

/// Valve's VDF/ACF is just `"key"  "value"` lines — split on quotes.
fn vdf_kv(line: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = line.split('"').collect();
    if parts.len() >= 4 { Some((parts[1].to_string(), parts[3].to_string())) } else { None }
}

fn steam_roots() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();
    #[cfg(windows)]
    {
        if let Some(pf) = std::env::var_os("ProgramFiles(x86)") { v.push(PathBuf::from(pf).join("Steam")); }
        if let Some(pf) = std::env::var_os("ProgramFiles") { v.push(PathBuf::from(pf).join("Steam")); }
        for d in ["C:\\Steam", "D:\\Steam", "E:\\Steam", "C:\\SteamLibrary", "D:\\SteamLibrary", "E:\\SteamLibrary", "F:\\SteamLibrary"] { v.push(PathBuf::from(d)); }
    }
    #[cfg(target_os = "macos")]
    if let Some(h) = std::env::var_os("HOME") { v.push(PathBuf::from(h).join("Library").join("Application Support").join("Steam")); }
    #[cfg(all(unix, not(target_os = "macos")))]
    if let Some(h) = std::env::var_os("HOME") { let h = PathBuf::from(h); v.push(h.join(".steam").join("steam")); v.push(h.join(".local").join("share").join("Steam")); }
    v.into_iter().filter(|p| p.join("steamapps").is_dir()).collect()
}

fn steam_games() -> Vec<Game> {
    let mut libs: Vec<PathBuf> = Vec::new();
    for root in steam_roots() {
        libs.push(root.clone());
        if let Ok(s) = std::fs::read_to_string(root.join("steamapps").join("libraryfolders.vdf")) {
            for line in s.lines() {
                if let Some((k, val)) = vdf_kv(line) { if k == "path" { libs.push(PathBuf::from(val.replace("\\\\", "\\"))); } }
            }
        }
    }
    libs.sort();
    libs.dedup();
    let mut out = Vec::new();
    for lib in libs {
        let Ok(rd) = std::fs::read_dir(lib.join("steamapps")) else { continue };
        for e in rd.flatten() {
            let p = e.path();
            let fname = p.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default();
            if !(fname.starts_with("appmanifest_") && fname.ends_with(".acf")) { continue; }
            let Ok(s) = std::fs::read_to_string(&p) else { continue };
            let (mut name, mut appid, mut size, mut dir, mut last) = (String::new(), String::new(), 0u64, String::new(), 0u64);
            for line in s.lines() {
                if let Some((k, v)) = vdf_kv(line) {
                    match k.as_str() {
                        "name" => name = v, "appid" => appid = v, "installdir" => dir = v,
                        "SizeOnDisk" => size = v.parse().unwrap_or(0), "LastPlayed" => last = v.parse().unwrap_or(0),
                        _ => {}
                    }
                }
            }
            if name.is_empty() || name.starts_with("Steamworks Common") || name.contains("Redistributable") || name.starts_with("Steam Linux Runtime") || name.starts_with("Proton") { continue; }
            let install_dir = lib.join("steamapps").join("common").join(&dir).to_string_lossy().to_string();
            out.push(Game { name, source: "Steam", app_id: appid, size_gb: (size as f32 / 1_073_741_824.0 * 10.0).round() / 10.0, install_dir, last_played: last });
        }
    }
    out
}

fn epic_games() -> Vec<Game> {
    let mut out = Vec::new();
    #[cfg(windows)]
    let dir = std::env::var_os("ProgramData").map(|p| PathBuf::from(p).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests"));
    #[cfg(target_os = "macos")]
    let dir = std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library").join("Application Support").join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests"));
    #[cfg(all(unix, not(target_os = "macos")))]
    let dir: Option<PathBuf> = None;
    let Some(dir) = dir else { return out };
    let Ok(rd) = std::fs::read_dir(dir) else { return out };
    for e in rd.flatten() {
        let p = e.path();
        if p.extension().map(|x| x != "item").unwrap_or(true) { continue; }
        let Ok(s) = std::fs::read_to_string(&p) else { continue };
        let Ok(j) = serde_json::from_str::<serde_json::Value>(&s) else { continue };
        let name = j["DisplayName"].as_str().unwrap_or("").to_string();
        if name.is_empty() { continue; }
        out.push(Game {
            name, source: "Epic", app_id: j["AppName"].as_str().unwrap_or("").to_string(),
            size_gb: (j["InstallSize"].as_f64().unwrap_or(0.0) as f32 / 1_073_741_824.0 * 10.0).round() / 10.0,
            install_dir: j["InstallLocation"].as_str().unwrap_or("").to_string(), last_played: 0,
        });
    }
    out
}

/// Steam (all library folders) + Epic, most recently played first.
#[tauri::command]
fn game_library() -> Vec<Game> {
    let mut g = steam_games();
    g.extend(epic_games());
    g.sort_by(|a, b| b.last_played.cmp(&a.last_played).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    g
}

#[derive(Serialize)]
struct RecentFile {
    name: String,
    ext: String,
    modified: u64,
}

/// What you were working on: Windows' Recent folder (shortcut names ARE the
/// file names), GNOME/KDE's recently-used.xbel on Linux. macOS keeps this in
/// per-app plists, so it stays empty there for now — honestly.
#[tauri::command]
fn recent_files() -> Vec<RecentFile> {
    let mut out: Vec<RecentFile> = Vec::new();
    #[cfg(windows)]
    if let Some(ad) = std::env::var_os("APPDATA") {
        if let Ok(rd) = std::fs::read_dir(PathBuf::from(ad).join("Microsoft").join("Windows").join("Recent")) {
            for e in rd.flatten() {
                let fname = e.file_name().to_string_lossy().to_string();
                if !fname.to_lowercase().ends_with(".lnk") { continue; }
                let name = fname[..fname.len() - 4].to_string();
                if name.eq_ignore_ascii_case("desktop.ini") || !name.contains('.') { continue; }
                let modified = e.metadata().ok().and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
                let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
                out.push(RecentFile { name, ext, modified });
            }
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    if let Some(h) = std::env::var_os("HOME") {
        if let Ok(s) = std::fs::read_to_string(PathBuf::from(h).join(".local").join("share").join("recently-used.xbel")) {
            for chunk in s.split("<bookmark ").skip(1) {
                let href = chunk.split("href=\"").nth(1).and_then(|x| x.split('"').next()).unwrap_or("");
                let name = href.rsplit('/').next().unwrap_or("").replace("%20", " ");
                if name.is_empty() || !name.contains('.') { continue; }
                let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
                out.push(RecentFile { name, ext, modified: 0 });
            }
        }
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    out.truncate(25);
    out
}

// ---------------------------------------------------------------- tray, close-to-tray, notifications
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

/// Closing the window hides it to the tray instead of quitting (Settings toggle).
pub struct CloseToTray(pub Mutex<bool>);

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open L.A.B Hub", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let mut b = TrayIconBuilder::with_id("main").menu(&menu).tooltip("L.A.B Hub").show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() { b = b.icon(icon.clone()); }
    b.on_menu_event(|app, e| match e.id().as_ref() {
        "open" => show_main(app),
        "quit" => app.exit(0),
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
            show_main(tray.app_handle());
        }
    })
    .build(app)?;
    Ok(())
}

#[tauri::command]
fn close_to_tray_get(state: tauri::State<'_, CloseToTray>) -> bool { *state.0.lock().unwrap() }

#[tauri::command]
fn close_to_tray_set(state: tauri::State<'_, CloseToTray>, enable: bool) -> bool { *state.0.lock().unwrap() = enable; enable }

/// OS notification (used for upcoming family events etc.). Never for marketing.
#[tauri::command]
fn notify(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification().builder().title(title.chars().take(80).collect::<String>()).body(body.chars().take(240).collect::<String>()).show().map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) { if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); } }

// ---------------------------------------------------------------- settings helpers

/// Is "start with your PC" on? (None if the platform can't say.)
#[tauri::command]
fn autostart_enabled(app: tauri::AppHandle) -> Option<bool> {
    app.autolaunch().is_enabled().ok()
}

#[tauri::command]
fn autostart_set(app: tauri::AppHandle, enable: bool) -> Result<bool, String> {
    let al = app.autolaunch();
    (if enable { al.enable() } else { al.disable() }).map_err(|e| e.to_string())?;
    al.is_enabled().map_err(|e| e.to_string())
}

/// Write a text file into the user's Downloads folder (data export). Returns the path.
#[tauri::command]
fn save_to_downloads(name: String, content: String) -> Result<String, String> {
    let safe: String = name.chars().filter(|c| c.is_alphanumeric() || matches!(c, '.' | '-' | '_')).collect();
    let safe = if safe.is_empty() { "lab-export.json".to_string() } else { safe };
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).ok_or("no home folder")?;
    let dir = PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(safe);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // started by autostart with --minimized → live in the tray until asked for
    let start_hidden = std::env::args().any(|a| a == "--minimized");
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_notification::init())
        .manage(Telemetry(Mutex::new(System::new_all())))
        .manage(CloseToTray(Mutex::new(true)))
        .setup(move |app| {
            setup_tray(app.handle())?;
            if start_hidden { if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); } }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && *window.state::<CloseToTray>().0.lock().unwrap() {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            device_info, server_url, profile_hint, quick_load, usage_snapshot, game_library, recent_files, live_device,
            autostart_enabled, autostart_set, save_to_downloads, close_to_tray_get, close_to_tray_set, notify, hide_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running L.A.B Hub");
}
