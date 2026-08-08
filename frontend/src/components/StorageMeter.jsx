import { HardDrive } from "lucide-react";
import { formatBytes } from "../lib/download";

export default function StorageMeter({ usedBytes = 0, quotaBytes = 0 }) {
  const pct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;

  return (
    <div className="border border-[#3a332b] rounded-xl bg-[#1d1a16] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-sm text-[#e8dfd1]">
          <HardDrive size={16} className="text-[#d4a373]" /> Storage used
        </span>
        <span className="text-xs text-[#a3978b] tabular-nums">
          {formatBytes(usedBytes)} of {quotaBytes ? formatBytes(quotaBytes) : "—"} · {pct.toFixed(1)}%
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-[#3a332b] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#d4a373] to-[#a0683a] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-[#6b635a]">
        <span>Used: {formatBytes(usedBytes)}</span>
        <span>Max: {quotaBytes ? formatBytes(quotaBytes) : "estimating…"}</span>
      </div>
    </div>
  );
}