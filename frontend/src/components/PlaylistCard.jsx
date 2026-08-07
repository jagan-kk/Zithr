import { Music, Play, Radio, Trash2 } from "lucide-react";

function sourceLabel(source) {
  if (source === "spotify_csv_import") return "Spotify CSV Import";
  if (source === "live_stream") return "Live Stream";
  return source || "Playlist";
}

export default function PlaylistCard({
  playlist,
  isActive,
  onSelect,
  onDelete,
  onAddToQueue,
}) {
  return (
    <div
      className={`group rounded-xl border p-4 transition cursor-pointer ${
        isActive
          ? "border-[#d4a373] bg-[#d4a373]/5"
          : "border-[#3a332b] bg-[#1d1a16] hover:border-[#d4a373]/60"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-[#e8dfd1] truncate">{playlist.title}</h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="p-1.5 rounded-full bg-[#d4a373] text-[#141210]"
            aria-label="Play playlist"
          >
            <Play size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToQueue();
            }}
            className="p-1.5 rounded-full text-[#a3978b] hover:text-[#d4a373]"
            aria-label="Queue playlist"
          >
            <Radio size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-full text-[#a3978b] hover:text-red-400"
            aria-label="Delete playlist"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#a3978b]">
        <Music size={13} />
        <span>{playlist.track_count} tracks</span>
      </div>
      <p className="mt-1 text-xs text-[#6b635a]">{sourceLabel(playlist.source)}</p>
    </div>
  );
}