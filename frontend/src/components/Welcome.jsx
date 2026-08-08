import { useEffect, useState } from "react";
import { ChevronUp, Layers, Radio } from "lucide-react";

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-[#d4a373]">{value}</p>
      <p className="text-[11px] text-[#6b635a]">{label}</p>
    </div>
  );
}

export default function Welcome({ playlists, idbTrackCount, idbStorageUsed, onExit }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const exit = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onExit, 600);
  };

  const totalTracks = playlists.reduce(
    (sum, p) => sum + (p.tracks?.length || p.track_count || 0),
    0
  );

  const stage = leaving ? "exit" : visible ? "in" : "initial";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#141210] transition-transform duration-700 ease-in-out ${
        stage === "exit"
          ? "-translate-y-full"
          : stage === "in"
          ? "translate-y-0"
          : "translate-y-full"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#d4a373]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-[#4a3422]/20 blur-3xl" />
      </div>

      <button
        onClick={exit}
        aria-label="Enter the app"
        title="Enter"
        className="relative self-center mt-6 group flex flex-col items-center gap-1 text-[#a3978b] hover:text-[#d4a373]"
      >
        <span className="grid place-items-center w-11 h-11 rounded-full border border-[#3a332b] group-hover:border-[#d4a373] group-hover:bg-[#d4a373]/10 transition-colors">
          <ChevronUp size={22} className="animate-bounce" />
        </span>
        <span className="text-[11px] uppercase tracking-widest">Enter</span>
      </button>

      <div className="relative flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[#d4a373] mb-6">
          <Layers size={15} /> VinylCloud
        </p>
        <h1 className="text-5xl md:text-7xl font-black text-[#e8dfd1] leading-none max-w-4xl">
          Every song you love.
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#d4a373] to-[#a0683a]">
            Streaming everywhere.
          </span>
        </h1>
        <p className="text-[#a89a8b] max-w-xl mt-6 leading-relaxed">
          Import any playlist, resolve each track to real audio on demand, cache
          it in your browser, and send it to your own apps through a simple
          key-protected API.
        </p>
      </div>

      <div className="relative flex items-center justify-center gap-10 pb-10">
        <Stat label="Playlists" value={playlists.length} />
        <div className="w-px h-8 bg-[#3a332b]" />
        <Stat label="Tracks" value={totalTracks} />
        <div className="w-px h-8 bg-[#3a332b]" />
        <Stat label="Cached in this browser" value={`${idbTrackCount} · ${idbStorageUsed}`} />
      </div>

      <p className="relative pb-6 text-center text-[11px] text-[#6b635a] inline-flex items-center justify-center gap-1">
        <Radio size={12} /> Tap the ^ to enter and start uploading
      </p>
    </div>
  );
}