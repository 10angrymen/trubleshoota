import { Monitor, Server, Activity, Search, Route, Network, Zap, ShieldCheck, Radar, FileCode, ArrowDownToLine, FileSearch } from "lucide-react";
import logo from "../assets/logo.png";
import { PROFILES } from "../config/profiles";
import { SavedReport, SystemInfo, TestResultLog } from "../types";
import { FC } from 'react';



interface SidebarProps {
    activeTab: "profiles" | "tools" | "reports";
    setActiveTab: (tab: "profiles" | "tools" | "reports") => void;
    activeTool: string;
    setActiveTool: (tool: any) => void;
    selectedProfileId: string;
    setSelectedProfileId: (id: string) => void;
    logs: TestResultLog[];
    saveReport: () => void;
    savedReports: SavedReport[];
    clearReports: () => void;
    sysInfo: SystemInfo | null;
}

export const Sidebar: FC<SidebarProps> = ({
    activeTab, setActiveTab,
    activeTool, setActiveTool,
    selectedProfileId, setSelectedProfileId,
    logs, saveReport, savedReports, clearReports, sysInfo
}) => {
    return (
        <aside className="w-64 border-r border-green-900/30 bg-black/80 backdrop-blur-md flex flex-col text-green-100 font-mono">
            <div className="p-6 flex items-center gap-3 border-b border-green-900/30">
                <img src={logo} alt="Logo" className="w-10 h-10 rounded-none border border-green-500/50 grayscale hover:grayscale-0 transition-all" />
                <div>
                    <h1 className="font-bold text-lg tracking-widest uppercase text-green-500">TrubleShoota</h1>
                    <div className="text-[10px] text-green-800 tracking-tighter">DA BOYZ DIAGNOSTICS</div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-green-900/50">
                <div className="flex items-center justify-between mb-6 bg-green-950/30 p-1 border border-green-900/30">
                    {["profiles", "tools", "reports"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 text-[10px] uppercase font-bold py-1.5 transition-all ${activeTab === tab ? "bg-green-600 text-black" : "text-green-700 hover:text-green-400"}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === "profiles" ? (
                    <>
                        <div className="text-[10px] font-bold text-green-800 uppercase tracking-widest mb-3 px-2">Battle Plans</div>
                        {PROFILES.map((profile) => (
                            <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={`w-full flex items-center gap-3 px-3 py-3 text-sm transition-all duration-200 border-l-2 ${selectedProfileId === profile.id ? "bg-green-500/10 text-green-400 border-green-500" : "border-transparent text-green-800 hover:text-green-300 hover:bg-green-900/20"}`}>
                                <Activity size={16} /><span>{profile.name}</span>
                            </button>
                        ))}
                    </>
                ) : activeTab === "tools" ? (
                    <>
                        <div className="text-[10px] font-bold text-green-800 uppercase tracking-widest mb-3 px-2">Mek Shop Tools</div>
                        <div className="space-y-1">
                            {[
                                { id: "ALL", name: "Dashboard", icon: Activity },
                                { id: "DNS", name: "Git Da IP (DNS)", icon: Search },
                                { id: "MTR", name: "Path Finder (MTR)", icon: Route },
                                { id: "SCAN", name: "Door Kicker (Port)", icon: Network },
                                { id: "LAN", name: "Who's There? (LAN)", icon: Radar },
                                { id: "WIFI", name: "Waaaaagh! Waves (WiFi)", icon: Activity },
                                { id: "CALC", name: "Choppa Calc (Subnet)", icon: FileCode },
                                { id: "SPEED", name: "More Dakka (Speed)", icon: Zap },
                                { id: "FRAG", name: "Packet Smasher (MTU)", icon: ArrowDownToLine },
                                { id: "PCAP", name: "Grot Sifter (PCAP)", icon: FileSearch },
                                { id: "CONVERT", name: "Loot Sorter (JSON)", icon: FileCode },
                            ].map(tool => (
                                <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`w-full flex items-center gap-3 px-3 py-3 text-sm transition-all border-l-2 ${activeTool === tool.id ? "bg-green-500/10 text-green-400 border-green-500" : "border-transparent text-green-800 hover:text-green-300 hover:bg-green-900/20"}`}>
                                    <tool.icon size={16} /> {tool.name}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold text-green-800 uppercase tracking-widest mb-3 px-2">War Logs</div>
                        {savedReports.map(r => (
                            <div key={r.id} className="bg-green-900/10 p-2 border border-green-900/30 text-xs hover:bg-green-900/30 cursor-pointer">
                                <div className="flex justify-between font-bold text-green-400 mb-1">
                                    <span>{r.profileName}</span>
                                </div>
                                <div className="flex gap-2 text-green-700">
                                    <span>{r.summary.pass} OK</span> / <span className="text-red-900">{r.summary.fail} FAIL</span>
                                </div>
                            </div>
                        ))}
                        {savedReports.length > 0 && (
                            <button onClick={clearReports} className="w-full text-xs text-red-900 mt-4 hover:text-red-500 uppercase font-bold tracking-wider">Burn Reports</button>
                        )}
                    </div>
                )}

                {activeTab === "profiles" && (
                    <div className="mt-auto px-2 pt-4">
                        <button onClick={saveReport} disabled={logs.length === 0} className={`w-full py-2 border flex items-center justify-center gap-2 uppercase font-bold text-xs tracking-wider transition-all ${logs.length > 0 ? "border-green-500/50 text-green-400 hover:bg-green-500/20 cursor-pointer" : "border-gray-800 text-gray-800 cursor-not-allowed"}`}><ShieldCheck size={14} /> Save Log</button>
                    </div>
                )}
            </div>

            {sysInfo && (
                <div className="p-4 border-t border-green-900/30 text-[10px] text-green-700 font-mono bg-black/40">
                    <div className="font-bold mb-1 text-green-600 uppercase">Mekboy Rig Status</div>
                    <div className="flex justify-between items-center mb-1"><span className="flex items-center gap-1"><Monitor size={10} /> RAM:</span><span>{Math.round(sysInfo.memory_used / 1024 / 1024 / 1024)}G / {Math.round(sysInfo.memory_total / 1024 / 1024 / 1024)}G</span></div>
                    <div className="flex justify-between items-center"><span className="flex items-center gap-1"><Server size={10} /> CPU:</span><span>{sysInfo.cpu_usage.toFixed(1)}%</span></div>
                </div>
            )}
        </aside>
    );
};
