use serde::{Serialize, Deserialize};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PingResult {
    pub host: String,
    pub status: String,
    pub time_ms: Option<u64>,
    pub output: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TcpResult {
    pub host: String,
    pub port: u16,
    pub status: String,
    pub time_ms: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JitterResult {
    pub host: String,
    pub avg_latency: u64,
    pub jitter: f64,
    pub packet_loss: f64,
    pub details: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MtuResult {
    pub host: String,
    pub mtu: u16,
    pub status: String,
    pub details: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NatResult {
    pub nat_type: String,
    pub public_ip: String,
    pub details: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DnsRecord {
    pub record_type: String,
    pub value: String,
    pub ttl: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TracerouteHop {
    pub hop: u8,
    pub ip: String,
    pub host_name: Option<String>,
    pub time_ms: Option<u64>,
    pub status: String, 
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PortScanResult {
    pub open_ports: Vec<u16>,
    pub host: String,
    pub scanned_count: u16,
    pub time_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThroughputResult {
    pub bytes_transferred: u64,
    pub duration_ms: u64,
    pub mbps: f64,
    pub status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GeoIp {
    pub status: String,
    pub country: Option<String>,
    #[serde(rename = "regionName")]
    pub region_name: Option<String>,
    pub city: Option<String>,
    pub isp: Option<String>,
    pub query: String, // IP
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LanDevice {
    pub ip: String,
    pub hostname: String,
    pub mac: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub host_name: String,
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PcapAnalysisResult {
    pub packet_count: usize,
    pub duration_sec: f64,
    pub issues: Vec<PcapIssue>,
    pub top_talkers: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PcapIssue {
    pub severity: String, // "critical", "warn", "info"
    pub title: String,
    pub description: String,
    pub timestamp: Option<f64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PortScanProgress {
    pub port: u16,
    pub status: String,
}

// --- Helpers ---
pub fn parse_ping_time(output: &str) -> Option<u64> {
     if let Some(pos) = output.find("time") {
         let part = &output[pos..];
         let end = part.find("ms").or_else(|| part.find(" "))?;
         let raw = part[..end]
            .replace("time", "")
            .replace("=", "")
            .replace("<", "")
            .trim()
            .to_string();
         
         if let Ok(val) = raw.parse::<f64>() {
             return Some(val.round() as u64);
         }
         raw.parse::<u64>().ok()
     } else {
         None
     }
}

pub fn get_mac_from_arp(ip: &str) -> String {
    #[cfg(target_os = "windows")]
    let args = ["-a"];
    #[cfg(not(target_os = "windows"))]
    let args = ["-a"]; 

    let mut cmd = Command::new("arp");
    cmd.args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    if let Ok(output) = cmd.output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains(ip) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                     if parts[0] == ip {
                         return parts[1].to_string();
                     }
                }
            }
        }
    }
    "Unknown".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ping_time_windows() {
        let output = "Reply from 8.8.8.8: bytes=32 time=14ms TTL=118";
        assert_eq!(parse_ping_time(output), Some(14));
    }

    #[test]
    fn test_parse_ping_time_linux() {
        // Linux often outputs float like 14.2 ms
        let output = "64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=14.2 ms";
        // This is expected to FAIL with current implementation if it contains dot
        let parsed = parse_ping_time(output);
        // We want it to be handled, maybe truncated or rounded.
        // If implementation is strict u64, it returns None.
        // Let's assert what we WANT (robustness).
        assert!(parsed.is_some(), "Should parse linux float time");
    }
    
    #[test]
    fn test_parse_ping_time_lessthan1() {
        let output = "Reply from 8.8.8.8: bytes=32 time<1ms TTL=118";
        assert_eq!(parse_ping_time(output), Some(1)); // The replace("<", "") logic should handle this
    }
}
