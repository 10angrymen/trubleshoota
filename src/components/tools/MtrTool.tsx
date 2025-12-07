import { useState, useEffect, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Route, MapPin } from "lucide-react";
import { TracerouteHop, MtrStats, GeoIp, PingResult } from "../../types";

interface MtrToolProps {
    host: string;
}

export const MtrTool: React.FC<MtrToolProps> = ({ host }) => {
    const [stats, setStats] = useState<MtrStats[]>([]);
    const [running, setRunning] = useState(false);
    const [geoInfo, setGeoInfo] = useState<Record<string, GeoIp>>({});
    const unlistenRef = useRef<(() => void) | null>(null);

    // Ping Loop
    useEffect(() => {
        let interval: any;
        if (running && stats.length > 0) {
            interval = setInterval(async () => {
                const promises = stats.map(async (hop) => {
                    if (!hop.ip || hop.ip === "Request Timed Out" || hop.ip === "*") return hop;
                    try {
                        const res = await invoke<PingResult>('execute_ping', { host: hop.ip });
                        const lat = res.time_ms || 0;
                        const isLoss = !res.time_ms;

                        return {
                            ...hop,
                            sent: hop.sent + 1,
                            lost: isLoss ? hop.lost + 1 : hop.lost,
                            lossPct: ((isLoss ? hop.lost + 1 : hop.lost) / (hop.sent + 1)) * 100,
                            last: lat,
                            best: (lat > 0 && lat < hop.best) || hop.best === 9999 ? lat : hop.best,
                            worst: lat > hop.worst ? lat : hop.worst,
                            avg: hop.avg === 0 ? lat : (hop.avg * hop.sent + lat) / (hop.sent + 1),
                            history: [...hop.history, { time: new Date().toLocaleTimeString(), latency: lat }].slice(-20)
                        };
                    } catch (e) { return hop; }
                });

                const nextStats = await Promise.all(promises);
                setStats(nextStats);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [running, stats]);

    const startMtr = async () => {
        setStats([]);
        setRunning(true);
        setGeoInfo({});

        unlistenRef.current = await listen<TracerouteHop>('trace_progress', (event) => {
            setStats(prev => {
                if (prev.some(h => h.hop === event.payload.hop)) return prev;

                const ip = event.payload.ip;
                // Fetch Geo
                if (ip && ip !== "*" && ip !== "Request Timed Out" && !geoInfo[ip]) {
                    invoke<GeoIp>('get_geo_ip', { ip }).then(geo => {
                        setGeoInfo(prevGeo => ({ ...prevGeo, [ip]: geo }));
                    });
                }

                const newHop: MtrStats = {
                    hop: event.payload.hop,
                    ip: event.payload.ip,
                    sent: 0, received: 0, lost: 0, lossPct: 0,
                    last: 0, best: 9999, avg: 0, worst: 0,
                    history: []
                };
                return [...prev, newHop].sort((a, b) => a.hop - b.hop);
            });
        });

        try {
            await invoke('run_traceroute', { host });
        } catch (e) {
            console.error(e);
            setRunning(false);
        } finally {
            if (unlistenRef.current) unlistenRef.current();
        }
    };

    const stopMtr = () => {
        setRunning(false);
        if (unlistenRef.current) unlistenRef.current();
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between bg-black/40 p-4 border border-green-900/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/20 rounded-lg">
                        <Route className="text-green-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase tracking-wider text-sm">Path Finder (MTR)</h2>
                        <div className="text-[10px] text-green-700 font-mono">Tracing route to: <span className="text-green-300">{host}</span></div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!running ? (
                        <button onClick={startMtr} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-black font-bold uppercase text-xs tracking-wider rounded transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                            Start Trace
                        </button>
                    ) : (
                        <button onClick={stopMtr} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 font-bold uppercase text-xs tracking-wider rounded border border-red-900 transition-all">
                            Stop Trace
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-black/40 border border-green-900/30 rounded-lg p-4 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-green-900/50">
                    <table className="w-full text-left text-xs font-mono">
                        <thead className="text-green-800 uppercase tracking-widest sticky top-0 bg-[#0c1017] z-10 border-b border-green-900/30">
                            <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">Host / IP</th>
                                <th className="p-2">Location / ISP</th>
                                <th className="p-2 text-right">Loss%</th>
                                <th className="p-2 text-right">Avg</th>
                                <th className="p-2 text-right">Best</th>
                                <th className="p-2 text-right">Worst</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-green-900/10">
                            {stats.map(hop => {
                                const geo = geoInfo[hop.ip];
                                return (
                                    <tr key={hop.hop} className="hover:bg-green-500/5 transition-colors">
                                        <td className="p-2 text-green-700">{hop.hop}</td>
                                        <td className="p-2 text-green-300 font-medium">{hop.ip}</td>
                                        <td className="p-2 text-green-600">
                                            {geo ? (
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-1 text-[10px] text-green-400"><MapPin size={10} /> {geo.city}, {geo.country}</span>
                                                    <span className="text-[9px] opacity-70">{geo.isp}</span>
                                                </div>
                                            ) : (hop.ip !== "*" && hop.ip !== "Request Timed Out" ? <span className="animate-pulse text-[9px] opacity-50">Thinking...</span> : "-")}
                                        </td>
                                        <td className={`p-2 text-right font-bold ${hop.lossPct > 10 ? "text-red-500" : hop.lossPct > 0 ? "text-yellow-500" : "text-green-500"}`}>{hop.lossPct.toFixed(1)}%</td>
                                        <td className="p-2 text-right text-green-400">{hop.avg.toFixed(1)}ms</td>
                                        <td className="p-2 text-right text-gray-500">{hop.best === 9999 ? 0 : hop.best}</td>
                                        <td className="p-2 text-right text-gray-500">{hop.worst}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="h-48 mt-4 border-t border-green-900/30 pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.length > 0 ? stats[0].history : []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                            <XAxis dataKey="time" hide />
                            <YAxis stroke="#065f46" fontSize={10} width={30} />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: '#022c22', borderColor: '#065f46', color: '#4ade80' }}
                                itemStyle={{ fontSize: 12, color: '#4ade80' }}
                            />
                            {stats.slice(0, 5).map((hop, i) => (
                                <Line
                                    key={hop.hop}
                                    data={hop.history}
                                    type="monotone"
                                    dataKey="latency"
                                    stroke={`hsl(${120 + (i * 20)}, 70%, 50%)`}
                                    dot={false}
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
