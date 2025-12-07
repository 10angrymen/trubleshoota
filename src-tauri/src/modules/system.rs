use sysinfo::System;
use crate::modules::utils::SystemInfo;

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();
    SystemInfo {
        os_name: System::name().unwrap_or("Unknown".to_string()),
        os_version: System::os_version().unwrap_or("Unknown".to_string()),
        host_name: System::host_name().unwrap_or("Unknown".to_string()),
        cpu_usage: sys.global_cpu_usage(),
        memory_used: sys.used_memory(),
        memory_total: sys.total_memory(),
    }
}
