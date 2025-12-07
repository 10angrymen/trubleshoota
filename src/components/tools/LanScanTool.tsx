import { useState, useRef, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Radar, Monitor } from "lucide-react";
import { LanDevice } from "../../types";

export const LanScanTool = () => {
    const [devices, setDevices] = useState<LanDevice[]>([]);
    const [scanning, setScanning] = useState(false);
    const unlistenRef = useRef<(() => void) | null>(null);

    const startScan = async () => {
        setDevices([]);
        setScanning(true);

        unlistenRef.current = await listen<LanDevice>('lan_scan_progress', (event) => {
            setDevices(prev => {
                if (prev.some(d => d.ip === event.payload.ip)) return prev;
                return [...prev, event.payload].sort((a, b) => {
                    // Sort by IP (simple last octet sort for /24)
                    const lastA = parseInt(a.ip.split('.').pop() || "0");
                    const lastB = parseInt(b.ip.split('.').pop() || "0");
                    return lastA - lastB;
                });
            });
        });

        try {
            const res = await invoke<LanDevice[]>('scan_local_network');
            // Merge final results just in case generic return captures something missed by event
            setDevices(res);
        } catch (e) {
            console.error(e);
        } finally {
            setScanning(false);
            if (unlistenRef.current) unlistenRef.current();
        }
    };

    useEffect(() => {
        return () => { if (unlistenRef.current) unlistenRef.current(); };
    }, []);

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between bg-black/40 p-4 border border-green-900/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/20 rounded-lg">
                        <Radar className="text-green-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase tracking-wider text-sm">Who's There? (LAN Scan)</h2>
                        <div className="text-[10px] text-green-700 font-mono">Subnet Reconnaissance</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={startScan} disabled={scanning} className={`px-6 py-2 font-bold uppercase text-xs tracking-wider rounded transition-all ${scanning ? "bg-green-900/20 text-green-800 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)]"}`}>
                        {scanning ? "Sweeping Sector..." : "Start Sweep"}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-black/40 border border-green-900/30 rounded-lg p-4 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto h-full pr-2 scrollbar-thin scrollbar-thumb-green-900/50">
                    {devices.map(device => (
                        <div key={device.ip} className="bg-green-900/10 border border-green-900/30 p-3 rounded flex items-center gap-3 hover:bg-green-900/20 transition-all group">
                            <div className="p-2 bg-green-900/40 rounded text-green-400 group-hover:text-green-200 transition-colors">
                                <Monitor size={20} />
                            </div>
                            <div>
                                <div className="text-green-300 font-mono font-bold text-sm tracking-wide">{device.ip}</div>
                                <div className="text-[10px] text-green-600 uppercase tracking-widest">{device.mac.toUpperCase()}</div>
                                <div className="text-[10px] text-green-700">{device.hostname}</div>
                            </div>
                        </div>
                    ))}
                    {devices.length === 0 && !scanning && (
                        <div className="col-span-full flex flex-col items-center justify-center text-green-900/50 h-64">
                            <Radar size={48} className="mb-2 opacity-50" />
                            <span className="uppercase tracking-widest text-xs">Sector Silent. Initiate Scan.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
