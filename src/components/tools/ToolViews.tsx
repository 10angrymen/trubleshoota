import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Search, Network, Zap } from "lucide-react";
import { DnsRecord, PortScanResult, ThroughputResult } from "../../types";

export const DnsTool = ({ host }: { host: string }) => {
    const [results, setResults] = useState<DnsRecord[]>([]);

    const run = async () => {
        setResults([]);
        try { setResults(await invoke<DnsRecord[]>('run_nslookup', { domain: host, typeStr: "A" })); } catch (e) { console.error(e); }
    };

    return (
        <div className="bg-black/40 border border-green-900/30 rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 text-green-400"><Search size={16} /> Git DA IP (DNS)</h3>
                <button onClick={run} className="px-4 py-1.5 bg-green-900/40 text-green-400 border border-green-900/50 rounded text-sm hover:bg-green-900/60 uppercase font-bold tracking-wider">Lookup</button>
            </div>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-xs flex-1 overflow-auto border border-green-900/20">
                {results.length === 0 ? <span className="opacity-30 text-green-700">Waiting for target...</span> :
                    results.map((r, i) => <div key={i} className="flex justify-between border-b border-green-900/20 pb-1 mb-1"><span className="text-green-500 font-bold">{r.record_type}</span><span className="text-green-200">{r.value}</span></div>)
                }
            </div>
        </div>
    );
};

export const PortScanTool = ({ host }: { host: string }) => {
    const [scanPortStart, setScanPortStart] = useState(80);
    const [scanPortEnd, setScanPortEnd] = useState(100);
    const [scanRunning, setScanRunning] = useState(false);
    const [scanResults, setScanResults] = useState<PortScanResult | null>(null);

    const run = async () => {
        setScanResults({ open_ports: [], host, scanned_count: 0, time_ms: 0 });
        setScanRunning(true);
        const unlisten = await listen<{ port: number, status: string }>('scan_progress', (event) => {
            if (event.payload.status === "OPEN") {
                setScanResults(prev => prev ? { ...prev, open_ports: [...prev.open_ports, event.payload.port] } : null);
            }
        });

        try {
            const res = await invoke<PortScanResult>('run_port_scan', { host, startPort: scanPortStart, endPort: scanPortEnd });
            setScanResults(res);
        } catch (e) { console.error(e); }
        finally {
            unlisten();
            setScanRunning(false);
        }
    };

    return (
        <div className="bg-black/40 border border-green-900/30 rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 text-green-400"><Network size={16} /> Door Kicker (Port Scan)</h3>
            </div>
            <p className="text-[10px] text-green-800 mb-4 uppercase tracking-widest">Find open entries.</p>

            <div className="flex gap-2 items-center bg-green-900/10 border border-green-900/30 p-2 rounded-lg mb-4 text-green-400">
                <span className="text-xs font-mono">Range:</span>
                <input type="number" className="w-16 bg-transparent border-b border-green-700/50 text-center text-sm outline-none text-green-300" value={scanPortStart} onChange={(e) => setScanPortStart(Number(e.target.value))} />
                <span className="text-green-700">-</span>
                <input type="number" className="w-16 bg-transparent border-b border-green-700/50 text-center text-sm outline-none text-green-300" value={scanPortEnd} onChange={(e) => setScanPortEnd(Number(e.target.value))} />
                <button onClick={run} disabled={scanRunning} className={`ml-auto px-4 py-1.5 rounded text-sm transition-all uppercase font-bold tracking-wider ${scanRunning ? "bg-green-900/10 text-green-900 cursor-not-allowed" : "bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30"}`}>Kick Doors</button>
            </div>

            <div className="bg-black/50 rounded-lg p-4 font-mono text-xs flex-1 overflow-auto border border-green-900/20 relative">
                {scanResults ? (
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-green-400">
                                {scanRunning ?
                                    <span className="animate-pulse">Kicking...</span> :
                                    `Kicked ${scanResults.scanned_count} doors in ${(scanResults.time_ms / 1000).toFixed(2)}s`
                                }
                            </div>
                            {!scanRunning && (
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        const content = JSON.stringify(scanResults, null, 2);
                                        navigator.clipboard.writeText(content);
                                    }} className="text-[10px] bg-green-900/40 text-green-400 px-2 py-1 rounded border border-green-700/30 hover:bg-green-800">CPY JSON</button>
                                    <button onClick={() => {
                                        const content = "Port,Status\n" + scanResults.open_ports.map(p => `${p},OPEN`).join("\n");
                                        navigator.clipboard.writeText(content);
                                    }} className="text-[10px] bg-green-900/40 text-green-400 px-2 py-1 rounded border border-green-700/30 hover:bg-green-800">CPY CSV</button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {scanResults.open_ports.length === 0 ? <span className="opacity-30 text-green-800">{scanRunning ? "Listening..." : "No entries found."}</span> :
                                scanResults.open_ports.map(p => <span key={p} className="bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded border border-green-500/40">:{p} OPEN</span>)
                            }
                        </div>
                    </div>
                ) : <span className="opacity-30 text-green-800">Ready to breach...</span>}
            </div>
        </div>
    );
};

export const ThroughputTool = ({ host }: { host: string }) => {
    const [port, setPort] = useState(443);
    const [duration, setDuration] = useState(5);
    const [result, setResult] = useState<ThroughputResult | null>(null);

    const run = async () => {
        setResult(null);
        try {
            const res = await invoke<ThroughputResult>('run_throughput_test', { host, port, durationSec: duration });
            setResult(res);
        } catch (e) { console.error(e); }
    };

    return (
        <div className="bg-black/40 border border-green-900/30 rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 text-green-400"><Zap size={16} /> More Dakka (Flood)</h3>
            </div>
            <p className="text-[10px] text-green-800 mb-4 uppercase tracking-widest">Stress Test Connection.</p>

            <div className="flex gap-2 items-center bg-green-900/10 border border-green-900/30 p-2 rounded-lg mb-4 text-green-400">
                <span className="text-xs font-mono px-2">Port:</span>
                <input type="number" className="w-16 bg-transparent border-b border-green-700/50 text-center text-sm outline-none text-green-300" value={port} onChange={(e) => setPort(Number(e.target.value))} />
                <span className="text-xs font-mono px-2 border-l border-green-900/30 ml-2">Secs:</span>
                <input type="number" className="w-12 bg-transparent border-b border-green-700/50 text-center text-sm outline-none text-green-300" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                <button onClick={run} className="ml-auto px-4 py-1.5 bg-red-900/20 text-red-400 border border-red-900/40 rounded text-sm hover:bg-red-900/30 uppercase font-bold tracking-wider">WAAAGH!</button>
            </div>

            <div className="bg-black/50 rounded-lg p-4 font-mono text-xs flex-1 overflow-auto border border-green-900/20">
                {result ? (
                    <div>
                        <div className="text-red-400 mb-2 font-bold text-lg">{result.mbps} Mbps</div>
                        <div className="text-green-600 flex gap-4">
                            <span>Total: {(result.bytes_transferred / 1024 / 1024).toFixed(2)} MB</span>
                            <span>Time: {(result.duration_ms / 1000).toFixed(1)}s</span>
                        </div>
                        <div className="text-[10px] mt-2 text-green-800">{result.status}</div>
                    </div>
                ) : <span className="opacity-30 text-green-800">Push button for Dakka...</span>}
            </div>
        </div>
    );
};
