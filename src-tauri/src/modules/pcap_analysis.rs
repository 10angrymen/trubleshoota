use pcap_parser::*;
use pcap_parser::traits::PcapReaderIterator;
use std::fs::File;
use std::collections::HashMap;

use crate::modules::utils::{PcapAnalysisResult, PcapIssue};

#[tauri::command]
pub async fn analyze_pcap_file(file_path: String) -> Result<PcapAnalysisResult, String> {
    
    // We run this in a blocking thread because pcap parsing is CPU intensive and blocking
    let res = tokio::task::spawn_blocking(move || {
        analyze_logic(&file_path)
    }).await;

    match res {
        Ok(inner_res) => inner_res,
        Err(e) => Err(e.to_string())
    }
}

fn analyze_logic(file_path: &str) -> Result<PcapAnalysisResult, String> {
    let file = File::open(file_path).map_err(|e| e.to_string())?;
    let mut reader = LegacyPcapReader::new(65536, file).map_err(|e| e.to_string())?;

    let mut packet_count = 0;
    let mut issues = Vec::new();
    let mut start_ts: f64 = 0.0;
    let mut end_ts: f64 = 0.0;
    
    // --- Advanced Heuristics ---
    let mut ip_counts: HashMap<String, usize> = HashMap::new();
    let mut fragments = 0;
    let mut arp_packets = 0;
    let mut broadcast_packets = 0;
    let mut multicast_packets = 0;
    let mut dns_queries = 0;
    let mut dhcp_discover = 0;
    
    // TCP Analysis
    // Key: "SrcIP:SrcPort->DstIP:DstPort" -> Last Seq Num
    let mut tcp_seq_tracker: HashMap<String, u32> = HashMap::new(); 
    let mut tcp_retransmissions = 0;
    let mut tcp_resets = 0;

    // Malware / Security Heuristics
    let mut suspicious_port_activity = 0;
    let mut suspected_dns_tunneling = 0;
    let mut cleartext_auth_count = 0;
    let mut deprecated_tls_count = 0;
    
    loop {
        match reader.next() {
            Ok((offset, block)) => {
                match block {
                    PcapBlockOwned::Legacy(packet) => {
                        let ts = packet.ts_sec as f64 + (packet.ts_usec as f64 / 1_000_000.0);
                        if packet_count == 0 { start_ts = ts; }
                        end_ts = ts;
                        packet_count += 1;

                        let data = packet.data;
                        if data.len() > 14 { 
                            let ethertype = u16::from_be_bytes([data[12], data[13]]);

                            if ethertype == 0x0806 { arp_packets += 1; }

                            if ethertype == 0x0800 && data.len() > 34 {
                                let protocol = data[23];
                                let src_ip = format!("{}.{}.{}.{}", data[26], data[27], data[28], data[29]);
                                let dst_ip = format!("{}.{}.{}.{}", data[30], data[31], data[32], data[33]);
                                
                                *ip_counts.entry(src_ip.clone()).or_insert(0) += 1;

                                let flags_offset = u16::from_be_bytes([data[20], data[21]]);
                                if (flags_offset & 0x2000) != 0 || (flags_offset & 0x1FFF) != 0 { fragments += 1; }

                                let ip_header_len = (data[14] & 0x0F) * 4;
                                let trans_offset = 14 + ip_header_len as usize;

                                if data.len() > trans_offset + 4 {
                                    let src_port = u16::from_be_bytes([data[trans_offset], data[trans_offset+1]]);
                                    let dst_port = u16::from_be_bytes([data[trans_offset+2], data[trans_offset+3]]);

                                    // --- 1. MALWARE: Suspicious Ports ---
                                    let suspicious_ports = [21, 23, 4444, 6667, 1337, 31337];
                                    if suspicious_ports.contains(&dst_port) {
                                        suspicious_port_activity += 1;
                                    }

                                    // --- 2. MALWARE: Cleartext Creds (Basic Auth) ---
                                    if data.len() > trans_offset + 20 {
                                        let payload = &data[trans_offset..];
                                        if payload.windows(20).any(|w| w == b"Authorization: Basic") {
                                            cleartext_auth_count += 1;
                                        }
                                    }

                                    // --- TCP Analysis ---
                                    if protocol == 6 && data.len() > trans_offset + 13 {
                                        let seq_num = u32::from_be_bytes([
                                            data[trans_offset+4], data[trans_offset+5], 
                                            data[trans_offset+6], data[trans_offset+7]
                                        ]);
                                        let flags = data[trans_offset+13];
                                        let is_syn = (flags & 0x02) != 0;
                                        let is_rst = (flags & 0x04) != 0;
                                        if is_rst { tcp_resets += 1; }
                                        let flow_key = format!("{}:{}->{}:{}", src_ip, src_port, dst_ip, dst_port);
                                        if !is_syn { 
                                            if let Some(&last_seq) = tcp_seq_tracker.get(&flow_key) {
                                                if seq_num == last_seq && data.len() > trans_offset + 20 { tcp_retransmissions += 1; }
                                            }
                                        }
                                        tcp_seq_tracker.insert(flow_key, seq_num);
                                    }

                                    // --- UDP Analysis ---
                                    if protocol == 17 {
                                        if dst_port == 53 {
                                            dns_queries += 1;
                                            // --- 3. MALWARE: DNS Tunneling Heuristic ---
                                            let udp_len = u16::from_be_bytes([data[trans_offset+4], data[trans_offset+5]]);
                                            if udp_len > 100 { 
                                                 suspected_dns_tunneling += 1;
                                            }
                                        }
                                        if dst_port == 67 || dst_port == 68 { dhcp_discover += 1; }
                                    }
                                    // --- 5. TLS Handshake Analysis ---
                                    if protocol == 6 && (dst_port == 443 || src_port == 443) && data.len() > trans_offset + 20 {
                                        // TLS Record Layer starts after TCP header
                                        // Content Type (1 byte) + Version (2 bytes) + Length (2 bytes)
                                        // Handshake (22) is what we care about
                                        // TCP Header length field
                                        let tcp_header_len = ((data[trans_offset+12] & 0xF0) >> 4) * 4;
                                        let tls_offset = trans_offset + tcp_header_len as usize;
                                        
                                        if data.len() > tls_offset + 5 {
                                             let content_type = data[tls_offset];
                                             let version_major = data[tls_offset+1];
                                             let version_minor = data[tls_offset+2];
                                             
                                             // 0x03 0x00 = SSL 3.0, 0x03 0x01 = TLS 1.0, 0x03 0x02 = TLS 1.1
                                             if content_type == 22 { 
                                                 if version_major == 3 {
                                                     // Count deprecated versions
                                                     if version_minor == 0 || version_minor == 1 { 
                                                         deprecated_tls_count += 1; 
                                                     }
                                                 }
                                             }
                                        }
                                    }
                                }
                            }

                             // --- 4. ETHERNET: Broadcast/Multicast ---
                            let is_broadcast = data[0] == 0xFF && data[1] == 0xFF && data[2] == 0xFF;
                            let is_multicast = (data[0] & 0x01) == 1 && !is_broadcast;
                            if is_broadcast { broadcast_packets += 1; }
                            if is_multicast { multicast_packets += 1; }
                        }
                    },
                    _ => {}
                }
                reader.consume(offset);
            },
            Err(PcapError::Eof) => break,
            Err(PcapError::Incomplete(_)) => {
                reader.refill().map_err(|e| e.to_string())?;
                continue;
            },
            Err(e) => return Err(e.to_string()),
        }
    }

    // --- ISSUE COMPILATION ---

    if suspicious_port_activity > 0 {
        issues.push(PcapIssue {
            severity: "critical".to_string(),
            title: "Suspicious Port Activity".to_string(),
            description: format!("Detected {} connections to known malware/insecure ports (21, 23, 4444, 31337). Check for C2 or unauthorized access.", suspicious_port_activity),
            timestamp: None,
        });
    }

    if suspected_dns_tunneling > 5 {
        issues.push(PcapIssue {
            severity: "critical".to_string(),
            title: "Potential DNS Tunneling".to_string(),
            description: format!("Found {} unusually large DNS packets. This is a common indication of data exfiltration or tunneling.", suspected_dns_tunneling),
            timestamp: None,
        });
    }

    if cleartext_auth_count > 0 {
        issues.push(PcapIssue {
            severity: "critical".to_string(),
            title: "Cleartext Credentials Leaked".to_string(),
            description: format!("Intercepted {} packets containing 'Authorization: Basic'. Passwords are being sent in plain text!", cleartext_auth_count),
            timestamp: None,
        });
    }

    if fragments > 0 {
        issues.push(PcapIssue {
            severity: "warn".to_string(),
            title: "IP Fragmentation Detected".to_string(),
            description: format!("Found {} fragmented packets. This causes audio dropouts and robotic voice.", fragments),
            timestamp: None,
        });
    }

    if tcp_retransmissions > 5 {
        let severity = if tcp_retransmissions > 100 { "critical" } else { "warn" };
        issues.push(PcapIssue {
            severity: severity.to_string(),
            title: "TCP Retransmissions".to_string(),
            description: format!("Congestion detected. {} retransmissions found. Expect application lag/stalls.", tcp_retransmissions),
            timestamp: None,
        });
    }

    if tcp_resets > 10 {
         issues.push(PcapIssue {
            severity: "warn".to_string(),
            title: "High TCP Reset Rate".to_string(),
            description: format!("Found {} TCP Resets (RST). Firewalls may be blocking traffic or services are crashing.", tcp_resets),
            timestamp: None,
        });
    }

    if packet_count > 0 && broadcast_packets > (packet_count / 10) && packet_count > 500 {
         issues.push(PcapIssue {
            severity: "critical".to_string(),
            title: "Broadcast Storm".to_string(),
            description: format!("Broadcast traffic is {:.1}% of total. This kills network performance.", (broadcast_packets as f64 / packet_count as f64) * 100.0),
            timestamp: None,
        });
    }

    if dhcp_discover > 15 {
        issues.push(PcapIssue {
             severity: "info".to_string(),
             title: "High DHCP Activity".to_string(),
             description: "Multiple DHCP Discover packets seen. Check for rogue DHCP servers or boot loops.".to_string(),
             timestamp: None,
        });
    }

    if packet_count > 0 && arp_packets > (packet_count / 5) && packet_count > 500 {
        issues.push(PcapIssue {
            severity: "warn".to_string(),
            title: "Excessive ARP Traffic".to_string(),
            description: "High volume of ARP requests detected. Could indicate a scanning tool or misconfigured subnet mask.".to_string(),
            timestamp: None,
        });
    }

    if packet_count > 0 && multicast_packets > (packet_count / 5) && packet_count > 500 {
        issues.push(PcapIssue {
            severity: "info".to_string(),
            title: "High Multicast Traffic".to_string(),
            description: "Significant multicast traffic detected. Ensure IGMP snooping is enabled.".to_string(),
            timestamp: None,
        });
    }

    if packet_count > 0 && dns_queries > (packet_count / 10) && packet_count > 500 {
        issues.push(PcapIssue {
             severity: "info".to_string(),
             title: "High DNS Activity".to_string(),
             description: format!("{} DNS queries found. Possible malware beaconing or misconfiguration.", dns_queries),
             timestamp: None,
        });
    }
    
    if deprecated_tls_count > 0 {
        issues.push(PcapIssue {
             severity: "warn".to_string(),
             title: "Deprecated TLS Usage".to_string(),
             description: format!("Found {} packets using legacy SSL 3.0 or TLS 1.0. This is a security risk (POODLE/BEAST).", deprecated_tls_count),
             timestamp: None,
        });
    }
    
    let duration = end_ts - start_ts;
    
    // Sort talkers
    let mut top_talkers: Vec<(String, usize)> = ip_counts.into_iter().collect();
    top_talkers.sort_by(|a, b| b.1.cmp(&a.1));
    let top_talkers_str: Vec<String> = top_talkers.into_iter().take(5).map(|(ip, c)| format!("{}: {} pkts", ip, c)).collect();

    Ok(PcapAnalysisResult {
        packet_count,
        duration_sec: duration,
        issues,
        top_talkers: top_talkers_str,
    })
}

#[cfg(test)]
mod tests {
    // Future expansion: create mock packet data to verify heuristics
    // This requires refactoring the main loop to accept a generic Iterator of Packets
    // rather than the specific File Reader.
}
