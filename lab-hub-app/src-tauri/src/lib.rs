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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Telemetry(Mutex::new(System::new_all())))
        .invoke_handler(tauri::generate_handler![device_info, server_url, profile_hint, quick_load, usage_snapshot])
        .run(tauri::generate_context!())
        .expect("error while running L.A.B Hub");
}
