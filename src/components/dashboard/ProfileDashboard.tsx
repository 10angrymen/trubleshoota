import { useRef, useEffect } from "react";
import { ArrowDown, Wifi, Globe, Terminal, ShieldCheck } from "lucide-react";
import { TestResultLog } from "../../types";

interface ProfileDashboardProps {
    activeProfile: any;
    logs: TestResultLog[];
    currentLatency: number | null;
    currentJitter: number | null;
    currentLoss: number | null;
}

export const ProfileDashboard: React.FC<ProfileDashboardProps> = ({
    activeProfile, logs, currentLatency, currentJitter, currentLoss
}) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div className="flex flex-col gap-6 h-full text-green-100">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-black/40 border border-green-900/40 rounded-xl p-4 shadow-sm backdrop-blur-sm">
                    <div className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Globe size={14} /> Ping Latency</div>
                    <div className="text-3xl font-mono font-bold text-green-400">{currentLatency !== null ? `${currentLatency}ms` : '--'}</div>
                </div>
                <div className="bg-black/40 border border-green-900/40 rounded-xl p-4 shadow-sm backdrop-blur-sm">
                    <div className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Wifi size={14} /> Jitter</div>
                    <div className={`text-3xl font-mono font-bold ${currentJitter && currentJitter > 30 ? 'text-yellow-500' : 'text-green-400'}`}>{currentJitter !== null ? `${currentJitter}ms` : '--'}</div>
                </div>
                <div className="bg-black/40 border border-green-900/40 rounded-xl p-4 shadow-sm backdrop-blur-sm">
                    <div className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><ArrowDown size={14} /> Packet Loss</div>
                    <div className={`text-3xl font-mono font-bold ${currentLoss && currentLoss > 0 ? 'text-red-500' : 'text-green-400'}`}>{currentLoss !== null ? `${currentLoss}%` : '--'}</div>
                </div>
                <div className="bg-black/40 border border-green-900/40 rounded-xl p-4 shadow-sm backdrop-blur-sm">
                    <div className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><ShieldCheck size={14} /> MTU Check</div>
                    <div className="text-sm font-mono pt-2 text-green-300">{activeProfile.mtu_check ? (logs.find(l => l.type === 'MTU')?.details.split(':')[1] || 'Pending...') : 'N/A'}</div>
                </div>
            </div>

            <div className="flex-1 bg-black/40 border border-green-900/40 rounded-xl p-6 shadow-sm flex flex-col min-h-[300px] backdrop-blur-sm">
                <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-4 flex items-center gap-2"><Terminal size={14} /> Battle Log</h3>
                <div className="flex-1 bg-black/60 rounded-lg border border-green-900/20 p-4 font-mono text-xs overflow-y-auto scrollbar-thin scrollbar-thumb-green-900/50">
                    {logs.length === 0 && <div className="text-green-900/50 italic animate-pulse">Waiting for orders...</div>}
                    {logs.map((log) => (
                        <div key={log.id} className="mb-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-3 hover:bg-green-900/10 p-0.5 rounded transition-colors group">
                            <span className="text-green-800 w-20">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span>
                            <span className={`font-bold w-12 text-center text-[10px] px-1 rounded border ${log.status === 'PASS' ? 'text-green-400 border-green-500/30 bg-green-500/10' : log.status === 'FAIL' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'}`}>{log.status}</span>
                            <span className="text-green-600 w-32 truncate group-hover:text-green-300 transition-colors" title={log.target}>{log.target}</span><span className="text-green-100/80">{log.details}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};
