// ... existing imports
export interface DnsRecord {
    record_type: string;
    value: string;
    ttl: number;
}

export interface TracerouteHop {
    hop: number;
    ip: string;
    host_name?: string;
    time_ms: number | null;
    status: string;
}

export interface MtrStats {
    hop: number;
    ip: string;
    sent: number;
    received: number;
    lost: number;
    lossPct: number;
    last: number;
    best: number;
    avg: number;
    worst: number;
    history: { time: string, latency: number }[];
}

export interface PortScanResult {
    open_ports: number[];
    host: string;
    scanned_count: number;
    time_ms: number;
}

export interface ThroughputResult {
    bytes_transferred: number;
    duration_ms: number;
    mbps: number;
    status: string;
}

export interface ConnectivityTarget {
    ip: string;
    ports?: number[];
    proto?: "tcp" | "udp" | "icmp";
    desc?: string;
}

export interface MediaQualityThresholds {
    jitter_ms?: number;
    packet_loss_percent?: number;
}

export interface UploadStressTest {
    target: string;
    duration_sec: number;
    min_bitrate_kbps: number;
}

export interface VendorProfile {
    id: string;
    name: string;
    description: string;
    icon?: string;
    connectivity_targets: ConnectivityTarget[];
    media_quality_thresholds?: MediaQualityThresholds;
    alg_test_enabled?: boolean;
    lan_isolation_check?: boolean;
    mtu_check?: boolean;
    upload_stress_test?: UploadStressTest;
    test_mode?: "standard" | "continuous_monitoring";
}

// Result Types matching Rust Backend
export interface PingResult {
    host: string;
    status: string;
    time_ms: number | null;
    output: string;
}

export interface TcpResult {
    host: string;
    port: number;
    status: string;
    time_ms: number | null;
}

export interface JitterResult {
    host: string;
    avg_latency: number;
    jitter: number;
    packet_loss: number;
    details: string;
}

export interface MtuResult {
    host: string;
    mtu: number;
    status: string;
    details: string;
}

export interface NatResult {
    nat_type: string;
    public_ip: string;
    details: string;
}

export interface SystemInfo {
    os_name: string;
    os_version: string;
    host_name: string;
    cpu_usage: number;
    memory_used: number;
    memory_total: number;
}

export interface TestResultLog {
    id: string;
    timestamp: number;
    target: string;
    type: "PING" | "TCP" | "JITTER" | "MTU" | "NAT" | "DNS" | "TRACE" | "SCAN" | "SPEED";
    status: "PASS" | "FAIL" | "WARN";
    details: string;
    latency?: number;
}

export interface SavedReport {
    id: string;
    timestamp: number;
    profileName: string;
    logs: TestResultLog[];
    summary: {
        pass: number;
        fail: number;
        warn: number;
    };
}

export interface GeoIp {
    status: string;
    country?: string;
    regionName?: string;
    city?: string;
    isp?: string;
    query: string;
}

export interface LanDevice {
    ip: string;
    hostname: string;
    mac: string;
    status: string;
}
