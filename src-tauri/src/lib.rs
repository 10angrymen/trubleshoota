mod modules;

use modules::net_ops;
use modules::system;
use modules::pcap_analysis;
use modules::wifi;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            net_ops::execute_ping,
            net_ops::run_jitter_test,
            net_ops::check_mtu, 
            net_ops::check_tcp_port, 
            net_ops::check_nat_type,
            system::get_system_info,
            net_ops::run_nslookup,
            net_ops::run_traceroute,
            net_ops::run_port_scan,
            net_ops::run_throughput_test,
            net_ops::get_geo_ip,
            net_ops::scan_local_network,
            pcap_analysis::analyze_pcap_file,
            wifi::get_wifi_signal_strength
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
