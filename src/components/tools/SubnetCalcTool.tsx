import { useState } from "react";
import { Calculator } from "lucide-react";

export const SubnetCalcTool = () => {
    const [ip, setIp] = useState("192.168.1.1");
    const [cidr, setCidr] = useState(24);

    const calculate = () => {
        // Parse IP
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
            return null;
        }
        const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];

        // Calculate Masks
        const maskNum = 0xFFFFFFFF << (32 - cidr);
        const wildcardNum = ~maskNum;

        // Network & Broadcast
        const netNum = ipNum & maskNum;
        const broadcastNum = netNum | wildcardNum;

        // Ranges
        const firstUsable = netNum + 1;
        const lastUsable = broadcastNum - 1;

        const numToIp = (n: number) => {
            return `${(n >>> 24) & 0xFF}.${(n >>> 16) & 0xFF}.${(n >>> 8) & 0xFF}.${n & 0xFF}`;
        };

        const hosts = Math.pow(2, 32 - cidr);
        const usable = hosts - 2 > 0 ? hosts - 2 : 0;

        return {
            network: numToIp(netNum),
            broadcast: numToIp(broadcastNum),
            first: numToIp(firstUsable),
            last: numToIp(lastUsable),
            mask: numToIp(maskNum),
            wildcard: numToIp(wildcardNum),
            hosts,
            usable,
            binaryIp: parts.map(p => p.toString(2).padStart(8, '0')).join('.'),
            binaryMask: numToIp(maskNum).split('.').map(p => parseInt(p).toString(2).padStart(8, '0')).join('.')
        };
    };

    const res = calculate();

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between bg-black/40 p-4 border border-green-900/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/20 rounded-lg">
                        <Calculator className="text-green-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase tracking-wider text-sm">Choppa Calculator (Subnet)</h2>
                        <div className="text-[10px] text-green-700 font-mono">Cut Networks into Bits</div>
                    </div>
                </div>
            </div>

            <div className="bg-black/40 border border-green-900/30 rounded-lg p-6 shadow-sm overflow-auto">
                <div className="flex flex-wrap gap-6 mb-8 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1 block">IP Address</label>
                        <input
                            className="w-full bg-black/50 border border-green-900/50 rounded px-4 py-2 text-sm text-green-400 focus:border-green-500 outline-none font-mono"
                            value={ip}
                            onChange={(e) => setIp(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1 block">CIDR / {cidr}</label>
                        <input
                            type="range" min="1" max="32"
                            className="w-full accent-green-500 h-2 bg-green-900/30 rounded-lg appearance-none cursor-pointer"
                            value={cidr}
                            onChange={(e) => setCidr(Number(e.target.value))}
                        />
                    </div>
                </div>

                {res ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
                        <ResultCard label="Network Address" value={res.network} />
                        <ResultCard label="Broadcast Address" value={res.broadcast} />
                        <ResultCard label="Subnet Mask" value={res.mask} />
                        <ResultCard label="Wildcard Mask" value={res.wildcard} />
                        <ResultCard label="Usable Hosts" value={res.usable.toLocaleString()} highlight />
                        <ResultCard label="Total Hosts" value={res.hosts.toLocaleString()} />
                        <ResultCard label="First Usable IP" value={res.first} />
                        <ResultCard label="Last Usable IP" value={res.last} />

                        <div className="col-span-full mt-4 p-4 bg-black/60 rounded border border-green-900/20 text-xs">
                            <div className="text-green-800 mb-1">BINARY_GUBBINZ</div>
                            <div className="text-green-500">{res.binaryIp}</div>
                            <div className="text-green-700">{res.binaryMask}</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-red-500 text-center py-8 opacity-50 font-mono">INVALID IP DATA DETECTED</div>
                )}
            </div>
        </div>
    );
};

const ResultCard = ({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) => (
    <div className={`p-3 rounded border ${highlight ? "bg-green-900/20 border-green-500/50" : "bg-black/30 border-green-900/30"}`}>
        <div className="text-[10px] text-green-700 uppercase tracking-widest mb-1">{label}</div>
        <div className={`font-bold tracking-wider ${highlight ? "text-green-300 text-lg" : "text-green-500"}`}>{value}</div>
    </div>
);
