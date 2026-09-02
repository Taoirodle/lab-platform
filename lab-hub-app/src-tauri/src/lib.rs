// ============================================================
//  L.A.B Hub — native shell (Tauri v2). A real compiled executable, not
//  Electron, not a PWA. The UI is the modular web front-end in ../src; Rust
//  provides the native commands the web layer can't do on its own.
// ============================================================
use serde::Serialize;
use sysinfo::{Disks, System};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![device_info, server_url])
        .run(tauri::generate_context!())
        .expect("error while running L.A.B Hub");
}
