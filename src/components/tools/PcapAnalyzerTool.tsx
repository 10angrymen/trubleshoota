import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FileSearch, AlertTriangle, FileText, CheckCircle, Activity, List, PieChart, ShieldAlert } from "lucide-react";

interface PcapIssue {
    severity: "critical" | "warn" | "info";
    title: string;
    description: string;
    timestamp?: number;
}

interface Conversation {
    source: string;
    destination: string;
    protocol: string;
    bytes: number;
    packets: number;
}

interface TcpAnalysisStats {
    retransmissions: number;
    zero_window: number;
    window_full: number;
    resets: number;
    avg_rtt_ms: number | null;
}

interface PcapAnalysisResult {
    packet_count: number;
    duration_sec: number;
    issues: PcapIssue[];
    top_talkers: string[];
    conversations: Conversation[];
    protocol_distribution: Record<string, number>;
    tcp_stats: TcpAnalysisStats;
}

export const PcapAnalyzerTool = () => {
    const [result, setResult] = useState<PcapAnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"summary" | "conversations" | "tcp" | "protocols">("summary");

    const selectFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'PCAP Files', extensions: ['pcap', 'cap', 'pcapng'] }]
            });

            if (selected && typeof selected === 'string') {
                setFileName(selected);
                analyze(selected);
            }
        } catch (e) { console.error(e); }
    };

    const analyze = async (path: string) => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await invoke<PcapAnalysisResult>('analyze_pcap_file', { filePath: path });
            setResult(res);
            setActiveTab("summary");
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const sortedProtocols = useMemo(() => {
        if (!result) return [];
        return Object.entries(result.protocol_distribution)
            .sort(([, a], [, b]) => b - a);
    }, [result]);

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between bg-black/40 p-4 border border-green-900/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/20 rounded-lg">
                        <FileSearch className="text-green-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase tracking-wider text-sm">Grot Sifter Pro</h2>
                        <div className="text-[10px] text-green-700 font-mono">Advanced Packet Forensics</div>
                    </div>
                </div>
                {result && (
                    <div className="flex gap-2">
                        {["summary", "conversations", "tcp", "protocols"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-all ${activeTab === tab ? 'bg-green-600 text-black' : 'bg-black/30 text-green-700 border border-green-900/30 hover:text-green-400'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 bg-black/40 border border-green-900/30 rounded-lg p-6 flex flex-col overflow-hidden relative">
                {!result && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <button onClick={selectFile} className="flex flex-col items-center gap-4 group">
                            <div className="w-24 h-24 rounded-full bg-green-900/10 border-2 border-dashed border-green-900/50 flex items-center justify-center group-hover:border-green-500 transition-all">
                                <FileText size={40} className="text-green-800 group-hover:text-green-400 transition-colors" />
                            </div>
                            <div className="text-green-600 font-bold uppercase tracking-widest text-sm group-hover:text-green-300">Load Capture File</div>
                        </button>
                        {error && <div className="mt-4 text-red-500 bg-red-900/10 p-2 rounded border border-red-900/30 text-xs font-mono max-w-md">{error}</div>}
                    </div>
                )}

                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="animate-spin text-green-500 text-4xl">⚙️</div>
                        <div className="text-green-400 font-mono text-xs animate-pulse">Dissecting frames... Calculating RTT... Analyzing Flows...</div>
                    </div>
                )}

                {result && (
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        {/* Header Stats */}
                        <div className="flex justify-between items-center bg-black/50 p-3 rounded border border-green-900/50 shrink-0">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-green-700 font-bold">File</span>
                                <span className="text-xs text-green-300 font-mono truncate max-w-[200px]" title={fileName}>{fileName.split('\\').pop()}</span>
                            </div>
                            <div className="flex gap-6 text-xs font-mono">
                                <div><span className="text-green-700">Packets:</span> <span className="text-green-400">{result.packet_count.toLocaleString()}</span></div>
                                <div><span className="text-green-700">Duration:</span> <span className="text-green-400">{result.duration_sec.toFixed(2)}s</span></div>
                                <div><span className="text-green-700">Avg Bandwidth:</span> <span className="text-green-400">{formatBytes((result.conversations.reduce((acc, c) => acc + c.bytes, 0)) / (result.duration_sec || 1))}/s</span></div>
                            </div>
                            <button onClick={() => setResult(null)} className="text-[10px] border border-green-900 text-green-700 px-2 py-1 rounded hover:bg-green-900/20 hover:text-green-400 uppercase">New</button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-h-0 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-green-900/50">

                            {activeTab === 'summary' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-black/20 border border-green-900/30 rounded p-4">
                                        <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Diagnostic Issues</h3>
                                        {result.issues.length === 0 ? (
                                            <div className="text-green-800 italic text-xs flex items-center gap-2"><CheckCircle size={14} /> Clean Capture. No anomalies.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {result.issues.map((issue, i) => (
                                                    <div key={i} className={`p-2 rounded border text-xs ${issue.severity === 'critical' ? 'bg-red-900/10 border-red-900/30 text-red-400' : issue.severity === 'warn' ? 'bg-yellow-900/10 border-yellow-900/30 text-yellow-500' : 'bg-green-900/10 border-green-900/30 text-green-400'}`}>
                                                        <div className="font-bold mb-1 flex justify-between">
                                                            <span>{issue.title}</span>
                                                            <span className="text-[10px] uppercase opacity-70 border px-1 rounded border-current">{issue.severity}</span>
                                                        </div>
                                                        <div className="opacity-80 font-mono">{issue.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-black/20 border border-green-900/30 rounded p-4">
                                        <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2"><Activity size={14} /> Network Health</h3>
                                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                            <div className="p-2 bg-black/40 rounded border border-green-900/20">
                                                <div className="text-green-700">Avg RTT</div>
                                                <div className={`text-lg ${!result.tcp_stats.avg_rtt_ms ? 'text-gray-600' : result.tcp_stats.avg_rtt_ms > 100 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {result.tcp_stats.avg_rtt_ms ? `${result.tcp_stats.avg_rtt_ms.toFixed(1)} ms` : 'N/A'}
                                                </div>
                                            </div>
                                            <div className="p-2 bg-black/40 rounded border border-green-900/20">
                                                <div className="text-green-700">Retransmissions</div>
                                                <div className={`text-lg ${result.tcp_stats.retransmissions > 100 ? 'text-red-400' : result.tcp_stats.retransmissions > 0 ? 'text-yellow-500' : 'text-green-400'}`}>
                                                    {result.tcp_stats.retransmissions}
                                                </div>
                                            </div>
                                            <div className="p-2 bg-black/40 rounded border border-green-900/20">
                                                <div className="text-green-700">Zero Windows</div>
                                                <div className={`text-lg ${result.tcp_stats.zero_window > 0 ? 'text-red-500' : 'text-green-400'}`}>
                                                    {result.tcp_stats.zero_window}
                                                </div>
                                            </div>
                                            <div className="p-2 bg-black/40 rounded border border-green-900/20">
                                                <div className="text-green-700">TCP Resets</div>
                                                <div className={`text-lg ${result.tcp_stats.resets > 50 ? 'text-yellow-500' : 'text-green-400'}`}>
                                                    {result.tcp_stats.resets}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'conversations' && (
                                <div className="bg-black/20 border border-green-900/30 rounded p-4">
                                    <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2"><List size={14} /> Top Conversations</h3>
                                    <table className="w-full text-xs text-left font-mono">
                                        <thead className="bg-green-900/20 text-green-400 uppercase">
                                            <tr>
                                                <th className="p-2">Source</th>
                                                <th className="p-2">Destination</th>
                                                <th className="p-2">Proto</th>
                                                <th className="p-2 text-right">Packets</th>
                                                <th className="p-2 text-right">Bytes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-green-900/20">
                                            {result.conversations.slice(0, 50).map((conv, i) => (
                                                <tr key={i} className="hover:bg-green-900/10 transition-colors">
                                                    <td className="p-2 text-green-300">{conv.source}</td>
                                                    <td className="p-2 text-green-300">{conv.destination}</td>
                                                    <td className="p-2 text-green-600">{conv.protocol}</td>
                                                    <td className="p-2 text-right text-green-500">{conv.packets}</td>
                                                    <td className="p-2 text-right text-green-400">{formatBytes(conv.bytes)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {result.conversations.length > 50 && (
                                            <tfoot>
                                                <tr>
                                                    <td colSpan={5} className="p-2 text-center text-green-800 italic">Showing top 50 / {result.conversations.length} conversations</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}

                            {activeTab === 'protocols' && (
                                <div className="bg-black/20 border border-green-900/30 rounded p-4">
                                    <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2"><PieChart size={14} /> Protocol Hierarchy</h3>
                                    <div className="space-y-2">
                                        {sortedProtocols.map(([proto, count]) => (
                                            <div key={proto} className="flex items-center gap-2 text-xs font-mono group">
                                                <div className="w-20 text-right text-green-700 group-hover:text-green-400">{proto}</div>
                                                <div className="flex-1 bg-green-900/10 h-4 rounded overflow-hidden relative border border-green-900/20">
                                                    <div
                                                        className="h-full bg-green-600/50 group-hover:bg-green-500/70 transition-all"
                                                        style={{ width: `${(count / result.packet_count) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <div className="w-16 text-right text-green-400">{((count / result.packet_count) * 100).toFixed(1)}%</div>
                                                <div className="w-16 text-right text-green-800">{count}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tcp' && (
                                <div className="bg-black/20 border border-green-900/30 rounded p-4 space-y-4">
                                    <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2"><ShieldAlert size={14} /> Detailed TCP Analysis</h3>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-1 p-3 bg-black/40 rounded border border-green-900/20 flex flex-col gap-2">
                                            <span className="text-green-700 text-xs uppercase font-bold">Latency (RTT)</span>
                                            <div className="text-2xl font-mono text-green-400">{result.tcp_stats.avg_rtt_ms ? result.tcp_stats.avg_rtt_ms.toFixed(2) : '-'} <span className="text-sm text-green-800">ms</span></div>
                                            <p className="text-[10px] text-green-700">Average Round Trip Time. &gt; 100ms indicates slow network path.</p>
                                        </div>
                                        <div className="col-span-1 p-3 bg-black/40 rounded border border-green-900/20 flex flex-col gap-2">
                                            <span className="text-green-700 text-xs uppercase font-bold">Reliability</span>
                                            <div className="text-2xl font-mono text-yellow-500">{result.tcp_stats.retransmissions} <span className="text-sm text-green-800">retrans</span></div>
                                            <p className="text-[10px] text-green-700">Mismatched sequence numbers indicating packet loss.</p>
                                        </div>
                                        <div className="col-span-1 p-3 bg-black/40 rounded border border-green-900/20 flex flex-col gap-2">
                                            <span className="text-green-700 text-xs uppercase font-bold">Congestion</span>
                                            <div className="text-2xl font-mono text-red-500">{result.tcp_stats.zero_window} <span className="text-sm text-green-800">zero win</span></div>
                                            <p className="text-[10px] text-green-700">Number of times receivers paused transmission (buffer full).</p>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-black/40 rounded border border-green-900/20">
                                        <h4 className="text-xs text-green-500 font-bold mb-2">Expert Analysis</h4>
                                        <ul className="list-disc list-inside text-xs text-green-300 font-mono space-y-1 opacity-80">
                                            <li>A high <span className="text-white">Retransmission</span> count suggests physical layer issues (cabling, signal) or router congestion.</li>
                                            <li><span className="text-white">Zero Window</span> events prove the bottleneck is the receiving ENDPOINT (server/client), not the network.</li>
                                            <li><span className="text-white">TCP Resets</span> usually imply a fireball blocking the connection or the service process crashing immediately.</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

