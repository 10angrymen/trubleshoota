import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Wifi } from "lucide-react";

interface WifiInfo {
    ssid: string;
    bssid: string;
    rssi: number;
    signal_quality: number;
    channel: number;
}

export const WifiTool = () => {
    const [info, setInfo] = useState<WifiInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const scan = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await invoke<WifiInfo>('get_wifi_signal_strength');
            setInfo(res);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { scan(); }, []);

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between bg-black/40 p-4 border border-green-900/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/20 rounded-lg">
                        <Wifi className="text-green-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase tracking-wider text-sm">Waaagh! Waves (WiFi)</h2>
                        <div className="text-[10px] text-green-700 font-mono">Signal Strength & Interference</div>
                    </div>
                </div>
                <button onClick={scan} disabled={loading} className={`px-4 py-1.5 rounded text-sm uppercase font-bold tracking-wider ${loading ? "bg-green-900/10 text-green-900 cursor-not-allowed" : "bg-green-900/40 text-green-400 border border-green-500/30 hover:bg-green-900/60"}`}>
                    {loading ? "Scanning..." : "Rescan"}
                </button>
            </div>

            <div className="flex-1 bg-black/40 border border-green-900/30 rounded-lg p-6 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
                {error && <div className="text-red-500 bg-red-900/10 p-4 rounded border border-red-900/30 font-mono text-xs">{error}</div>}

                {info && !error && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-md">
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-green-400 tracking-widest uppercase mb-1">{info.ssid}</h3>
                            <div className="text-green-800 font-mono text-xs tracking-wider">{info.bssid}</div>
                        </div>

                        <div className="w-full bg-green-900/10 h-8 rounded-full border border-green-900/30 relative overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ease-out ${info.signal_quality > 80 ? "bg-green-500" : info.signal_quality > 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${info.signal_quality}%` }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black uppercase tracking-widest bg-blend-overlay">
                                Signal Quality: {info.signal_quality}%
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="bg-black/50 p-4 rounded border border-green-900/30 text-center">
                                <div className="text-[10px] text-green-700 uppercase tracking-widest mb-1">RSSI</div>
                                <div className="text-xl font-bold text-green-400">{info.rssi} dBm</div>
                            </div>
                            <div className="bg-black/50 p-4 rounded border border-green-900/30 text-center">
                                <div className="text-[10px] text-green-700 uppercase tracking-widest mb-1">Channel</div>
                                <div className="text-xl font-bold text-green-400">{info.channel}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
