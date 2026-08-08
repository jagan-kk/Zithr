import { useState } from "react";
import { Check, CheckCircle2, Download, Music, Play, Trash2 } from "lucide-react";

export default function TrackList({
  tracks,
  currentTrack,
  isPlaying,
  onPlay,
  cachedMap = {},
  onDeleteSelected,
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === tracks.length) return new Set();
      return new Set(tracks.map((t) => t.id));
    });
  };

  const cancelSelection = () => {
    setSelected(new Set());
    setSelecting(false);
  };

  const deleteSelected = () => {
    if (!selected.size) return;
    onDeleteSelected?.([...selected]);
    cancelSelection();
  };

  if (!tracks || tracks.length === 0) {
    return (
      <p className="text-sm text-[#6b635a] py-6 text-center">
        No tracks in this playlist yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 min-h-[28px]">
        {selecting ? (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="text-xs text-[#a3978b] hover:text-[#d4a373] flex items-center gap-1"
            >
              <Check size={13} /> {selected.size === tracks.length ? "Unselect all" : "Select all"}
            </button>
            <span className="text-xs text-[#6b635a]">{selected.size} selected</span>
            <button
              onClick={deleteSelected}
              disabled={selected.size === 0}
              className="flex items-center gap-1 rounded-lg bg-red-500/90 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-40"
            >
              <Trash2 size={13} /> Delete ({selected.size})
            </button>
            <button
              onClick={cancelSelection}
              className="text-xs text-[#a3978b] hover:text-[#d4a373]"
            >
              Cancel
            </button>
          </div>
        ) : (
          onDeleteSelected && (
            <button
              onClick={() => setSelecting(true)}
              className="text-xs text-[#a3978b] hover:text-[#d4a373] flex items-center gap-1"
            >
              <Check size={13} /> Select
            </button>
          )
        )}
      </div>

      <ul className="divide-y divide-[#3a332b]">
        {tracks.map((track, idx) => {
          const isCurrent = currentTrack?.id === track.id;
          const cached = cachedMap[track.id];
          const downloaded = Boolean(cached?.blobData);
          return (
            <li
              key={track.id}
              onClick={() => (selecting ? toggle(track.id) : onPlay(track, tracks))}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                selecting && selected.has(track.id)
                  ? "bg-[#d4a373]/15"
                  : isCurrent
                    ? "bg-[#d4a373]/10"
                    : "hover:bg-[#1d1a16]"
              }`}
            >
              {selecting ? (
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                    selected.has(track.id)
                      ? "bg-[#d4a373] text-[#141210] border-[#d4a373]"
                      : "border-[#6b635a]"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(track.id);
                  }}
                >
                  {selected.has(track.id) ? "✓" : ""}
                </span>
              ) : (
                <span className="w-6 text-center text-xs text-[#6b635a] tabular-nums">
                  {idx + 1}
                </span>
              )}
              {!selecting &&
                (isCurrent && isPlaying ? (
                  <Play size={14} className="text-[#d4a373]" />
                ) : (
                  <Music size={14} className="text-[#a3978b]" />
                ))}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm truncate ${isCurrent ? "text-[#d4a373]" : "text-[#e8dfd1]"}`}
                >
                  {track.title}
                </p>
                <p className="text-xs text-[#a3978b] truncate">
                  {track.artist} · {track.album}
                </p>
              </div>
              <span className="text-xs text-[#6b635a] tabular-nums">
                {track.duration}
              </span>
              {downloaded ? (
                <span className="flex items-center gap-1 text-xs text-emerald-500">
                  <CheckCircle2 size={14} />
                  {cached.file_size || "Downloaded"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-[#6b635a]">
                  <Download size={14} /> Not cached
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
