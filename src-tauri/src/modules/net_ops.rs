use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::Emitter;
use std::net::{TcpStream, UdpSocket, ToSocketAddrs, SocketAddr};
use std::time::{Duration, Instant};
use stunclient::StunClient;
use tokio::net::TcpStream as TokioTcpStream;
use tokio::io::AsyncWriteExt;
use local_ip_address::local_ip;
use std::sync::Arc;
use regex::Regex;

use crate::modules::utils::{
    PingResult, JitterResult, MtuResult, TcpResult, NatResult, DnsRecord, TracerouteHop, 
    PortScanProgress, PortScanResult, ThroughputResult, GeoIp, LanDevice,
    parse_ping_time, get_mac_from_arp
};

#[tauri::command]
pub async fn execute_ping(host: String) -> PingResult {
    #[cfg(target_os = "windows")]
    let args = ["-n", "1", "-w", "1000", &host];
    #[cfg(not(target_os = "windows"))]
    let args = ["-c", "1", "-W", "1", &host];

    let mut cmd = Command::new("ping");
    cmd.args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let success = o.status.success() && (stdout.contains("Reply from") || stdout.contains("bytes from"));
            let time_ms = if success { parse_ping_time(&stdout) } else { None };

            PingResult {
                host,
                status: if success { "Success".to_string() } else { "Timeout".to_string() },
                time_ms,
                output: stdout.lines().take(4).collect::<Vec<&str>>().join("\n"),
            }
        },
        Err(e) => PingResult { host, status: "Error".to_string(), time_ms: None, output: e.to_string() }
    }
}

#[tauri::command]
pub async fn run_jitter_test(host: String, count: u8) -> JitterResult {
    let count_str = count.to_string();
    
    #[cfg(target_os = "windows")]
    let args = ["-n", &count_str, "-w", "1000", &host];
    #[cfg(not(target_os = "windows"))]
    let args = ["-c", &count_str, &host];

    let mut cmd = Command::new("ping");
    cmd.args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    match cmd.output() {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let mut latencies: Vec<u64> = Vec::new();
            for line in stdout.lines() {
                if let Some(ms) = parse_ping_time(line) {
                    latencies.push(ms);
                }
            }

            let received = latencies.len();
            if received == 0 {
                return JitterResult { host, avg_latency: 0, jitter: 0.0, packet_loss: 100.0, details: "100% Packet Loss".to_string() };
            }

            let sum: u64 = latencies.iter().sum();
            let avg = sum / received as u64;
            
            let variance: f64 = latencies.iter().map(|&x| {
                let diff = x as f64 - avg as f64;
                diff * diff
            }).sum::<f64>() / received as f64;
            let jitter = variance.sqrt();
            let loss_pct = ((count as f64 - received as f64) / count as f64) * 100.0;

            JitterResult {
                host,
                avg_latency: avg,
                jitter: (jitter * 100.0).round() / 100.0,
                packet_loss: loss_pct,
                details: format!("Recv: {}/{}, Jitter: {:.2}ms", received, count, jitter),
            }
        },
        Err(e) => JitterResult { host, avg_latency: 0, jitter: 0.0, packet_loss: 100.0, details: e.to_string() }
    }
}

#[tauri::command]
pub async fn check_mtu(host: String) -> MtuResult {
    let sizes = [1472, 1400, 1300, 1200, 500];
    for &size in sizes.iter() {
        #[cfg(target_os = "windows")]
        let args = ["-n", "1", "-f", "-l", &size.to_string(), &host];
        #[cfg(not(target_os = "windows"))]
        let args = ["-c", "1", "-M", "do", "-s", &size.to_string(), &host];

        let mut cmd = Command::new("ping");
        cmd.args(args);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        if let Ok(o) = cmd.output() {
             let stdout = String::from_utf8_lossy(&o.stdout).to_string();
             if !stdout.contains("Fragment") && !stdout.contains("too large") && (stdout.contains("Reply") || stdout.contains("bytes from")) {
                 return MtuResult {
                     host,
                     mtu: size + 28,
                     status: "Pass".to_string(),
                     details: format!("Max: {} bytes", size + 28)
                 };
             }
        }
    }
    MtuResult { host, mtu: 0, status: "Fail".to_string(), details: "Blocked/Unknown".to_string() }
}

#[tauri::command]
pub async fn check_tcp_port(host: String, port: u16) -> TcpResult {
    let addr = format!("{}:{}", host, port);
    let start = Instant::now();
    let timeout = Duration::from_secs(2);

    if let Ok(mut iter) = addr.to_socket_addrs() {
        if let Some(s_addr) = iter.next() {
            if TcpStream::connect_timeout(&s_addr, timeout).is_ok() {
                return TcpResult { host, port, status: "Open".to_string(), time_ms: Some(start.elapsed().as_millis() as u64) };
            } 
        }
    }
    TcpResult { host, port, status: "Closed".to_string(), time_ms: None }
}

#[tauri::command]
pub async fn check_nat_type() -> NatResult {
    let stun_server = "stun.l.google.com:19302";
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
            let _ = socket.set_read_timeout(Some(Duration::from_secs(3)));
            let _ = socket.set_write_timeout(Some(Duration::from_secs(3)));

            let server_addrs: Vec<SocketAddr> = stun_server.to_socket_addrs().unwrap().collect();
            if server_addrs.is_empty() {
                 return NatResult { nat_type: "Error".to_string(), public_ip: "DNS Fail".to_string(), details: "No IP for STUN".to_string() };
            }
            
            let client = StunClient::new(server_addrs[0]);
            
            match client.query_external_address(&socket) {
                Ok(addr) => NatResult {
                    nat_type: "Detected".to_string(),
                    public_ip: addr.to_string(),
                    details: format!("Via {}", stun_server),
                },
                Err(e) => NatResult { nat_type: "Error".to_string(), public_ip: "N/A".to_string(), details: e.to_string() }
            }
        },
        Err(e) => NatResult { nat_type: "Error".to_string(), public_ip: "N/A".to_string(), details: e.to_string() }
    }
}

#[tauri::command]
pub async fn run_nslookup(domain: String, _type_str: String) -> Vec<DnsRecord> {
    let domain_clone = domain.clone();
    let res = tokio::task::spawn_blocking(move || {
        (domain_clone.as_str(), 0).to_socket_addrs()
    }).await;

    let mut results = Vec::new();
    if let Ok(Ok(iter)) = res {
        for addr in iter {
            let ip = addr.ip();
            results.push(DnsRecord {
                record_type: if ip.is_ipv4() { "A".to_string() } else { "AAAA".to_string() },
                value: ip.to_string(),
                ttl: 0,
            });
        }
    }
    results
}

#[tauri::command]
pub async fn run_traceroute(app: tauri::AppHandle, host: String) -> Vec<TracerouteHop> {
    #[cfg(target_os = "windows")]
    let mut child = {
        let mut cmd = Command::new("tracert");
        cmd.args(["-h", "15", "-d", &host]);
        cmd.creation_flags(0x08000000);
        cmd.stdout(std::process::Stdio::piped())
           .spawn()
           .expect("failed to execute tracert")
    };
    
    #[cfg(not(target_os = "windows"))]
    let mut child = Command::new("traceroute").args(["-m", "15", "-n", &host]).stdout(std::process::Stdio::piped()).spawn().expect("failed to execute traceroute");

    let stdout = child.stdout.take().unwrap();
    let reader = std::io::BufReader::new(stdout);
    let mut hops = Vec::new();
    let re = Regex::new(r"^\s*(\d+)\s+(?:(\d+|<1)\s*ms|\*)\s+(?:(\d+|<1)\s*ms|\*)\s+(?:(\d+|<1)\s*ms|\*)\s+(.*)$").unwrap();

    use std::io::BufRead;
    for line in reader.lines() {
        if let Ok(l) = line {
            if let Some(caps) = re.captures(&l) {
                let hop_num = caps[1].parse::<u8>().unwrap_or(0);
                let ip = caps[5].trim().to_string();
                let is_timeout = l.contains("*        *        *") || ip == "Request timed out.";
                let time_str = caps.get(2).map_or("*", |m| m.as_str());
                let time_ms = time_str.replace("ms", "").trim().parse::<u64>().ok();

                let hop = TracerouteHop {
                    hop: hop_num,
                    ip: if is_timeout { "Request Timed Out".to_string() } else { ip.to_string() },
                    host_name: None,
                    time_ms,
                    status: if is_timeout { "Timeout".to_string() } else { "Success".to_string() }
                };
                
                hops.push(hop.clone());
                let _ = app.emit("trace_progress", hop); // Real-time emit
            }
        }
    }
    hops
}

#[tauri::command]
pub async fn run_port_scan(app: tauri::AppHandle, host: String, start_port: u16, end_port: u16) -> PortScanResult {
    let start_time = Instant::now();
    let timeout_duration = Duration::from_millis(500); 

    let host = std::sync::Arc::new(host); 
    
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    
    let app_handle = app.clone();
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let _ = app_handle.emit("scan_progress", msg);
        }
    });

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(100)); // Max 100 concurrent connects

    let mut open_ports_handles = Vec::new();

    for port in start_port..=end_port {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let host_ref = host.clone();
        let tx_ref = tx.clone();
        
        let task = tokio::spawn(async move {
            let addr_str = format!("{}:{}", host_ref, port);
            let mut is_open = false;

            if let Ok(mut iter) = addr_str.to_socket_addrs() {
                if let Some(s_addr) = iter.next() {
                    if let Ok(Ok(_)) = tokio::time::timeout(timeout_duration, TokioTcpStream::connect(s_addr)).await {
                        is_open = true;
                    }
                }
            }
            
            drop(permit); // Release slot
            
            if is_open {
                 let _ = tx_ref.send(PortScanProgress { port, status: "OPEN".to_string() }).await;
                 return Some(port);
            }
            None
        });
        open_ports_handles.push(task);
    }

    let mut open_ports = Vec::new();
    for handle in open_ports_handles {
        if let Ok(Some(port)) = handle.await {
            open_ports.push(port);
        }
    }
    open_ports.sort();

    PortScanResult {
        host: host.to_string(),
        open_ports,
        scanned_count: end_port - start_port + 1,
        time_ms: start_time.elapsed().as_millis() as u64,
    }
}

#[tauri::command]
pub async fn run_throughput_test(host: String, port: u16, duration_sec: u64) -> ThroughputResult {
    let addr = format!("{}:{}", host, port);
    
    match TokioTcpStream::connect(&addr).await {
        Ok(mut stream) => {
            let start = Instant::now();
            let mut total_bytes = 0u64;
            let chunk = [0u8; 8192];
            
            while start.elapsed().as_secs() < duration_sec {
               if stream.write_all(&chunk).await.is_err() {
                   break;
               }
               total_bytes += chunk.len() as u64;
            }
            
            let elapsed_s = start.elapsed().as_secs_f64();
            let bps = (total_bytes * 8) as f64 / elapsed_s;
            let mbps = bps / 1_000_000.0;

            ThroughputResult {
                bytes_transferred: total_bytes,
                duration_ms: (elapsed_s * 1000.0) as u64,
                mbps: (mbps * 100.0).round() / 100.0,
                status: "Success".to_string(),
            }
        },
        Err(e) => {
            ThroughputResult {
                bytes_transferred: 0,
                duration_ms: 0,
                mbps: 0.0,
                status: format!("Connect Failed: {}", e),
            }
        }
    }
}

#[tauri::command]
pub async fn get_geo_ip(ip: String) -> GeoIp {
    let url = format!("http://ip-api.com/json/{}?fields=status,message,country,regionName,city,isp,query", ip);
    match reqwest::get(&url).await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<GeoIp>().await {
                json
            } else {
                GeoIp { status: "fail".to_string(), country: None, region_name: None, city: None, isp: None, query: ip }
            }
        },
        Err(_) => GeoIp { status: "fail".to_string(), country: None, region_name: None, city: None, isp: None, query: ip }
    }
}

#[tauri::command]
pub async fn scan_local_network(app: tauri::AppHandle) -> Vec<LanDevice> {
    let my_local_ip = local_ip().unwrap_or("127.0.0.1".parse().unwrap());
    let ip_str = my_local_ip.to_string();
    let parts: Vec<&str> = ip_str.split('.').collect();
    
    if parts.len() != 4 {
        return vec![];
    }
    
    let subnet = format!("{}.{}.{}.", parts[0], parts[1], parts[2]);
    let mut devices = Vec::new();
    
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    let app_handle = app.clone();

    // Spawn listener
    tokio::spawn(async move {
        while let Some(dev) = rx.recv().await {
            let _ = app_handle.emit("lan_scan_progress", dev);
        }
    });

    let semaphore = Arc::new(tokio::sync::Semaphore::new(50)); // Max 50 pings at once
    let mut handles = Vec::new();

    // Scan 1 to 254
    for i in 1..255 {
        let target_ip = format!("{}{}", subnet, i);
        if target_ip == ip_str { continue; }

        let sem = semaphore.clone();
        let tx_scan = tx.clone();
        
        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            
            // Ping
            #[cfg(target_os = "windows")]
            let args = ["-n", "1", "-w", "200", &target_ip]; // Fast ping
            #[cfg(not(target_os = "windows"))]
            let args = ["-c", "1", "-W", "1", &target_ip];

            let mut cmd = Command::new("ping");
            cmd.args(args);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000);

            if let Ok(status) = cmd.status() {
                if status.success() {
                    // It's alive. Try to get MAC.
                    let mac = get_mac_from_arp(&target_ip);
                    let hostname = "Unknown".to_string(); 

                    let dev = LanDevice {
                        ip: target_ip,
                        hostname,
                        mac,
                        status: "Online".to_string()
                    };
                    let _ = tx_scan.send(dev.clone()).await;
                    return Some(dev);
                }
            }
            None
        }));
    }

    for h in handles {
         if let Ok(Some(d)) = h.await {
             devices.push(d);
         }
    }
    
    devices
}
