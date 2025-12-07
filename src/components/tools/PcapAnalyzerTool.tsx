import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FileSearch, AlertTriangle, FileText, CheckCircle } from "lucide-react";

interface PcapIssue {
    severity: "critical" | "warn" | "info";
    title: string;
    description: string;
    timestamp?: number;
}

interface PcapAnalysisResult {
    packet_count: number;
    duration_sec: number;
    issues: PcapIssue[];
    top_talkers: string[];
}

export const PcapAnalyzerTool = () => {
    const [result, setResult] = useState<PcapAnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState("");

    const selectFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'PCAP Files', extensions: ['pcap', 'cap'] }]
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
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between bg-black/40 p-4 border border-green-900/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/20 rounded-lg">
                        <FileSearch className="text-green-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase tracking-wider text-sm">Grot Sifter (PCAP)</h2>
                        <div className="text-[10px] text-green-700 font-mono">Packet Capture Analysis</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-black/40 border border-green-900/30 rounded-lg p-6 flex flex-col items-center justify-center gap-6 overflow-auto relative">
                {!result && !loading && (
                    <div className="text-center">
                        <button onClick={selectFile} className="flex flex-col items-center gap-4 group">
                            <div className="w-24 h-24 rounded-full bg-green-900/10 border-2 border-dashed border-green-900/50 flex items-center justify-center group-hover:border-green-500 transition-all">
                                <FileText size={40} className="text-green-800 group-hover:text-green-400 transition-colors" />
                            </div>
                            <div className="text-green-600 font-bold uppercase tracking-widest text-sm group-hover:text-green-300">Select .PCAP File</div>
                        </button>
                        {error && <div className="mt-4 text-red-500 bg-red-900/10 p-2 rounded border border-red-900/30 text-xs font-mono max-w-md">{error}</div>}
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin text-green-500 text-4xl">⚙️</div>
                        <div className="text-green-400 font-mono text-xs animate-pulse">Sifting through the scrap...</div>
                    </div>
                )}

                {result && (
                    <div className="w-full h-full flex flex-col gap-4">
                        <div className="flex justify-between items-center bg-black/50 p-3 rounded border border-green-900/50">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-green-700 font-bold">File</span>
                                <span className="text-xs text-green-300 font-mono truncate max-w-[200px]" title={fileName}>{fileName.split('\\').pop()}</span>
                            </div>
                            <div className="flex gap-4 text-xs font-mono">
                                <div><span className="text-green-700">Pkts:</span> <span className="text-green-400">{result.packet_count}</span></div>
                                <div><span className="text-green-700">Dur:</span> <span className="text-green-400">{result.duration_sec.toFixed(2)}s</span></div>
                            </div>
                            <button onClick={() => setResult(null)} className="text-[10px] border border-green-900 text-green-700 px-2 py-1 rounded hover:bg-green-900/20 hover:text-green-400 uppercase">New</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                            <div className="bg-black/20 border border-green-900/30 rounded p-4 flex flex-col">
                                <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Issues Found</h3>
                                <div className="flex-1 overflow-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-green-900/50">
                                    {result.issues.length === 0 && <div className="text-green-800 italic text-xs flex items-center gap-2"><CheckCircle size={14} /> No obvious issues detected.</div>}
                                    {result.issues.map((issue, i) => (
                                        <div key={i} className={`p-2 rounded border text-xs ${issue.severity === 'warn' ? 'bg-yellow-900/10 border-yellow-900/30 text-yellow-500' : 'bg-green-900/10 border-green-900/30 text-green-400'}`}>
                                            <div className="font-bold mb-1">{issue.title}</div>
                                            <div className="opacity-80 font-mono">{issue.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-black/20 border border-green-900/30 rounded p-4 flex flex-col">
                                <h3 className="text-xs font-bold uppercase text-green-600 mb-3 flex items-center gap-2">📢 Top Talkers</h3>
                                <div className="flex-1 overflow-auto font-mono text-xs text-green-400 space-y-1">
                                    {result.top_talkers.map((t, i) => (
                                        <div key={i} className="border-b border-green-900/20 pb-1 last:border-0">{t}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
