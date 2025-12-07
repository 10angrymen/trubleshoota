import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowDownToLine, ShieldAlert } from "lucide-react";
import { MtuResult } from "../../types";

export const FragTool = ({ host }: { host: string }) => {
    const [result, setResult] = useState<MtuResult | null>(null);
    const [running, setRunning] = useState(false);

    const run = async () => {
        setResult(null);
        setRunning(true);
        try {
            const res = await invoke<MtuResult>('check_mtu', { host: host || "8.8.8.8" });
            setResult(res);
        } catch (e) { console.error(e); }
        finally { setRunning(false); }
    };

    return (
        <div className="bg-black/40 border border-green-900/30 rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 text-green-400"><ArrowDownToLine size={16} /> Packet Smasher (Pro Frag)</h3>
            </div>
            <p className="text-[10px] text-green-800 mb-4 uppercase tracking-widest">MTU & Fragmentation Analysis.</p>

            <div className="flex gap-2 items-center bg-green-900/10 border border-green-900/30 p-2 rounded-lg mb-4 text-green-400">
                <span className="text-xs font-mono">Target:</span>
                <span className="text-xs font-mono text-green-300 border-b border-green-900/50 px-2">{host || "8.8.8.8"}</span>
                <button onClick={run} disabled={running} className={`ml-auto px-4 py-1.5 rounded text-sm transition-all uppercase font-bold tracking-wider ${running ? "bg-green-900/10 text-green-900 cursor-not-allowed" : "bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30"}`}>{running ? "Smashing..." : "Check MTU"}</button>
            </div>

            <div className="bg-black/50 rounded-lg p-4 font-mono text-xs flex-1 overflow-auto border border-green-900/20 flex flex-col items-center justify-center">
                {result ? (
                    <div className="text-center">
                        <div className="text-[10px] uppercase text-green-700 tracking-widest mb-1">Max Transmit Unit</div>
                        <div className={`text-4xl font-bold mb-2 ${result.status === 'Pass' ? 'text-green-400' : 'text-red-500'}`}>{result.mtu}</div>
                        <div className="text-green-600 flex items-center gap-2 justify-center bg-green-900/10 px-3 py-1 rounded-full border border-green-900/30">
                            <ShieldAlert size={12} /> {result.details}
                        </div>
                    </div>
                ) : <span className="opacity-30 text-green-800">Ready to test fragmentation...</span>}
            </div>
        </div>
    );
};
