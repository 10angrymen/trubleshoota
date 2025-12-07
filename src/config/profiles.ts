import { VendorProfile } from "../types";

export const PROFILES: VendorProfile[] = [
    {
        id: "generic-voip",
        name: "General VoIP",
        description: "Standard checklist for SIP-based Voice over IP services.",
        icon: "Phone",
        connectivity_targets: [
            { ip: "8.8.8.8", desc: "Public DNS (Connectivity)", proto: "icmp" },
            { ip: "1.1.1.1", desc: "Secondary DNS", proto: "icmp" },
        ],
        alg_test_enabled: true,
        mtu_check: true,
        media_quality_thresholds: {
            jitter_ms: 30,
            packet_loss_percent: 1,
        },
    },
    {
        id: "zoom",
        name: "Zoom",
        description: "Zoom Meetings, Webinars, and Zoom Phone (Targeting US Media Blocks).",
        icon: "Video",
        connectivity_targets: [
            { ip: "zoom.us", ports: [8801, 443], proto: "tcp", desc: "Signaling / Web" },
            { ip: "162.255.37.11", ports: [3478, 8801], proto: "udp", desc: "Zoom Media (US West Block)" },
            { ip: "64.211.144.11", ports: [3478], proto: "udp", desc: "Zoom Media (US East Block)" },
        ],
        mtu_check: true,
        media_quality_thresholds: {
            jitter_ms: 30,
            packet_loss_percent: 2,
        },
    },
    {
        id: "ringcentral",
        name: "RingCentral",
        description: "Unified Communications (Supernet Connectivity).",
        icon: "PhoneCall",
        connectivity_targets: [
            { ip: "sip.ringcentral.com", ports: [5060, 443], proto: "tcp", desc: "SIP Signaling" },
            { ip: "66.81.240.10", desc: "Media Supernet (SJC)", proto: "udp" },
            { ip: "80.81.128.10", desc: "Media Supernet (IAD)", proto: "udp" },
        ],
        alg_test_enabled: true,
        mtu_check: true,
    },
    {
        id: "8x8",
        name: "8x8",
        description: "Voice, Video, and Contact Center connectivity.",
        icon: "PhoneForwarded",
        connectivity_targets: [
            { ip: "192.84.16.1", ports: [443, 5060], proto: "tcp", desc: "Signaling / US Block" },
            { ip: "8.28.0.1", desc: "Global Media Relay", proto: "udp" },
        ],
        alg_test_enabled: true,
        mtu_check: true,
    },
    {
        id: "dialpad",
        name: "Dialpad",
        description: "AI-Powered Customer Intelligence Platform.",
        icon: "Mic",
        connectivity_targets: [
            { ip: "dialpad.com", ports: [443], proto: "tcp", desc: "Web / Signaling" },
            { ip: "turn.ubervoip.net", ports: [3478, 443], proto: "udp", desc: "TURN / Media Relay" },
            { ip: "66.23.129.11", desc: "Voice Network Block", proto: "udp" },
        ],
        alg_test_enabled: true,
        mtu_check: true,
    },
    {
        id: "discord",
        name: "Discord",
        description: "Voice, Video, and Streaming diagnostics (High UDP Range).",
        icon: "Gamepad2",
        connectivity_targets: [
            { ip: "gateway.discord.gg", ports: [443], proto: "tcp", desc: "Gateway / Text Chat" },
            { ip: "162.159.128.233", ports: [50000, 50005], proto: "udp", desc: "Voice Region (Sample)" },
        ],
        mtu_check: true,
        media_quality_thresholds: {
            jitter_ms: 20,
            packet_loss_percent: 0.5,
        },
    },
    {
        id: "twitch",
        name: "Twitch Streamer",
        description: "Upload stability and ingest server reachability for streamers.",
        icon: "Cast",
        mtu_check: true,
        upload_stress_test: {
            target: "rtmp://live-jfk.twitch.tv/app",
            duration_sec: 30,
            min_bitrate_kbps: 6000,
        },
        connectivity_targets: [
            { ip: "live-jfk.twitch.tv", ports: [1935, 443], proto: "tcp", desc: "Ingest Server (US-East)" },
        ],
    },
    {
        id: "citrix",
        name: "Citrix / VDI",
        description: "Remote work connectivity focusing on MTU and reliable transport.",
        icon: "Monitor",
        connectivity_targets: [
            { ip: "citrix.com", ports: [443, 1494, 2598], proto: "tcp", desc: "ICA/HDX Control" },
        ],
        mtu_check: true,
    },
    {
        id: "gamer",
        name: "Pro Gamer",
        description: "Latency stability, packet loss burst analysis, and LAN isolation.",
        icon: "Gamepad2",
        connectivity_targets: [
            { ip: "1.1.1.1", desc: "Public DNS (General Health)", proto: "icmp" },
            { ip: "162.249.72.1", desc: "Riot Games (US)", proto: "icmp" },
            { ip: "137.221.106.102", desc: "Blizzard (US Central)", proto: "icmp" },
        ],
        test_mode: "continuous_monitoring",
        lan_isolation_check: true,
        mtu_check: true,
    },
];
