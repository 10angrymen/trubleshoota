import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { ProfileDashboard } from "./components/dashboard/ProfileDashboard";
import { MtrTool } from "./components/tools/MtrTool";
import { LanScanTool } from "./components/tools/LanScanTool";
import { FragTool } from "./components/tools/FragTool";
import { PcapAnalyzerTool } from "./components/tools/PcapAnalyzerTool";
import { FirewallConverterTool } from "./components/tools/FirewallConverterTool";
import { DnsTool, PortScanTool, ThroughputTool } from "./components/tools/ToolViews";
import { WifiTool } from "./components/tools/WifiTool";
import { SubnetCalcTool } from "./components/tools/SubnetCalcTool";
import { PROFILES } from "./config/profiles";
import { SavedReport, TestResultLog, SystemInfo, NatResult, JitterResult, TcpResult, MtuResult, LanDevice } from "./types";
import { Play, Activity, ShieldCheck } from "lucide-react";

function App() {
  const [activeTab, setActiveTab] = useState<"profiles" | "tools" | "reports">("profiles");
  const [activeTool, setActiveTool] = useState<"ALL" | "DNS" | "MTR" | "SCAN" | "SPEED" | "LAN" | "FRAG" | "PCAP" | "CONVERT" | "WIFI" | "CALC">("ALL");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(PROFILES[0].id);

  // Profile Mode State
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<TestResultLog[]>([]);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [currentJitter, setCurrentJitter] = useState<number | null>(null);
  const [currentLoss, setCurrentLoss] = useState<number | null>(null);

  // System State
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    const saved = localStorage.getItem("net_reports");
    return saved ? JSON.parse(saved) : [];
  });

  // Tools State
  const [toolHost, setToolHost] = useState("google.com");

  const activeProfile = PROFILES.find(p => p.id === selectedProfileId) || PROFILES[0];

  useEffect(() => {
    const fetchSys = () => invoke<SystemInfo>('get_system_info').then(setSysInfo).catch(console.error);
    fetchSys();
    const interval = setInterval(fetchSys, 5000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (log: Omit<TestResultLog, "id" | "timestamp">) => {
    setLogs(prev => [...prev, { ...log, id: Math.random().toString(36), timestamp: Date.now() }]);
  };

  const saveReport = () => {
    if (logs.length === 0) return;
    const summary = {
      pass: logs.filter(l => l.status === "PASS").length,
      fail: logs.filter(l => l.status === "FAIL").length,
      warn: logs.filter(l => l.status === "WARN").length
    };
    const newReport: SavedReport = {
      id: Math.random().toString(36),
      timestamp: Date.now(),
      profileName: activeProfile.name,
      logs: [...logs],
      summary
    };
    const updated = [newReport, ...savedReports];
    setSavedReports(updated);
    localStorage.setItem("net_reports", JSON.stringify(updated));
  };

  const runDiagnostics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    addLog({ target: "System", type: "PING", status: "PASS", details: `Initializing ${activeProfile.name} Protocol...` });

    try {
      if (activeProfile.alg_test_enabled || activeProfile.id === 'gamer') {
        try {
          const natRes = await invoke<NatResult>('check_nat_type');
          addLog({
            target: "STUN Check", type: "NAT",
            status: natRes.nat_type === "Unknown" || natRes.nat_type === "Error" ? "FAIL" : "PASS",
            details: `${natRes.nat_type}: ${natRes.public_ip}`
          });
        } catch (e) { addLog({ target: "STUN", type: "NAT", status: "FAIL", details: `STUN Failed: ${e}` }); }
      }

      for (const target of activeProfile.connectivity_targets) {
        if (target.proto === 'icmp' || !target.proto || target.proto === 'udp') {
          try {
            const res = await invoke<JitterResult>('run_jitter_test', { host: target.ip, count: 20 });
            setCurrentLatency(res.avg_latency); setCurrentJitter(res.jitter); setCurrentLoss(res.packet_loss);
            addLog({
              target: target.ip, type: "JITTER", status: (res.packet_loss < 5 && res.jitter < 50) ? "PASS" : "FAIL",
              details: `Avg: ${res.avg_latency}ms, Jitter: ${res.jitter}ms, Loss: ${res.packet_loss}%`, latency: res.avg_latency
            });
          } catch (e) { addLog({ target: target.ip, type: "JITTER", status: "FAIL", details: `Error: ${e}` }); }
        }
        if (target.proto === 'tcp' && target.ports) {
          for (const port of target.ports) {
            try {
              const res = await invoke<TcpResult>('check_tcp_port', { host: target.ip, port });
              addLog({
                target: `${target.ip}:${port}`, type: "TCP", status: res.status === 'Open' ? "PASS" : "FAIL",
                details: res.status === 'Open' ? `Open (${res.time_ms}ms)` : `Closed`, latency: res.time_ms || undefined
              });
            } catch (e) { addLog({ target: `${target.ip}:${port}`, type: "TCP", status: "FAIL", details: `Error: ${e}` }); }
          }
        }
      }

      if (activeProfile.lan_isolation_check) {
        try {
          // In isolation check, we want to know if OTHER devices are present.
          // scan_local_network returns a list. If len > 1 (gateway + self), it might be an issue for "pure" isolation.
          // Typically scan finds everything responding.
          const devices = await invoke<LanDevice[]>('scan_local_network');
          const activeCount = devices.length;
          if (activeCount > 2) { // arbitrary threshold: self + gateway = 2. >2 means others.
            addLog({ target: "LAN", type: "SCAN", status: "WARN", details: `Isolation Fail: ${activeCount} Active Devices Found` });
          } else {
            addLog({ target: "LAN", type: "SCAN", status: "PASS", details: "Isolation Verified (Minimal Traffic)" });
          }
        } catch (e) { console.error(e); }
      }

      if (activeProfile.mtu_check) {
        const targetHost = activeProfile.connectivity_targets[0]?.ip || "8.8.8.8";
        try {
          const mtuRes = await invoke<MtuResult>('check_mtu', { host: targetHost });
          addLog({ target: targetHost, type: "MTU", status: mtuRes.status === 'Pass' ? "PASS" : "WARN", details: mtuRes.details });
        } catch (e) { addLog({ target: targetHost, type: "MTU", status: "FAIL", details: `MTU Error: ${e}` }); }
      }
      addLog({ target: "System", type: "PING", status: "PASS", details: "Diagnostic Cycle Complete." });
    } catch (err) { console.error(err); addLog({ target: "System", type: "PING", status: "FAIL", details: "Critical Harness Error" }); } finally { setIsRunning(false); }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-[#e0e0e0] overflow-hidden font-sans selection:bg-green-900 selection:text-white">
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        activeTool={activeTool} setActiveTool={setActiveTool}
        selectedProfileId={selectedProfileId} setSelectedProfileId={setSelectedProfileId}
        logs={logs} saveReport={saveReport} savedReports={savedReports} clearReports={() => { localStorage.removeItem("net_reports"); setSavedReports([]) }}
        sysInfo={sysInfo}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/10 via-[#050505] to-[#050505]">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c4a2510_1px,transparent_1px),linear-gradient(to_bottom,#0c4a2510_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

        <header className="h-auto min-h-16 py-4 flex flex-col md:flex-row items-center justify-between px-8 border-b border-green-900/30 backdrop-blur-sm relative z-10 gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-green-500 uppercase tracking-wider">
              {activeTab === "profiles" ? <><Activity className="text-green-500" /> {activeProfile.name} Monitor</> : "Mekboy Workshop"}
            </h2>
            <p className="text-[11px] text-green-700 font-mono tracking-tight">{activeTab === "profiles" ? activeProfile.description : "Advanced Diagnostics & Network Warfare"}</p>
          </div>
          {activeTab === "profiles" && (
            <div><button onClick={runDiagnostics} disabled={isRunning} className={`flex items-center gap-2 px-6 py-2 rounded font-bold uppercase tracking-widest text-xs transition-all duration-300 shadow-[0_0_15px_rgba(34,197,94,0.1)] ${isRunning ? "bg-green-900/10 text-green-800 cursor-not-allowed border border-green-900/20" : "bg-green-600 text-black hover:bg-green-500 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"}`}>{isRunning ? <><span className="animate-spin mr-1">⌘</span>Running Protocol...</> : <><Play size={16} fill="currentColor" /> Run Diagnostics</>}</button></div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 relative z-10 flex flex-col gap-6">
          {activeTab === "profiles" ? (
            <ProfileDashboard
              activeProfile={activeProfile}
              logs={logs}
              currentLatency={currentLatency}
              currentJitter={currentJitter}
              currentLoss={currentLoss}
            />
          ) : activeTab === "tools" ? (
            <div className="flex flex-col gap-6 h-full">
              {activeTool !== "ALL" && activeTool !== "LAN" && activeTool !== "CONVERT" && activeTool !== "PCAP" && activeTool !== "WIFI" && activeTool !== "CALC" && (
                <div className="bg-black/40 border border-green-900/30 rounded-xl p-6 shadow-sm space-y-4 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1 block">Data Target (Host/IP)</label>
                      <input className="w-full bg-black/50 border border-green-900/50 rounded px-4 py-2 text-sm text-green-400 focus:border-green-500 outline-none font-mono placeholder-green-900" placeholder="e.g. google.com" value={toolHost} onChange={(e) => setToolHost(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-green-900/50">
                {activeTool === "ALL" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-[300px]"><DnsTool host={toolHost} /></div>
                    <div className="h-[300px]"><ThroughputTool host={toolHost} /></div>
                    <div className="col-span-full h-[300px]"><MtrTool host={toolHost} /></div>
                  </div>
                )}
                {activeTool === "DNS" && <DnsTool host={toolHost} />}
                {activeTool === "MTR" && <MtrTool host={toolHost} />}
                {activeTool === "SCAN" && <PortScanTool host={toolHost} />}
                {activeTool === "SPEED" && <ThroughputTool host={toolHost} />}
                {activeTool === "FRAG" && <FragTool host={toolHost} />}
                {activeTool === "PCAP" && <PcapAnalyzerTool />}
                {activeTool === "LAN" && <LanScanTool />}
                {activeTool === "WIFI" && <WifiTool />}
                {activeTool === "CALC" && <SubnetCalcTool />}
                {activeTool === "CONVERT" && <FirewallConverterTool />}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-green-800">
              <ShieldCheck size={48} className="mb-4 opacity-50" />
              <h3 className="text-xl uppercase font-bold tracking-widest">Report Archives</h3>
              <p className="text-xs font-mono mt-2">Select a report from the sidebar to view details.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
