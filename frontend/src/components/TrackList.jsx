import { CheckCircle2, Download, Music, Play } from "lucide-react";

export default function TrackList({ tracks, currentTrack, isPlaying, onPlay, cachedMap = {} }) {
  if (!tracks || tracks.length === 0) {
    return (
      <p className="text-sm text-[#6b635a] py-6 text-center">
        No tracks in this playlist yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#3a332b]">
      {tracks.map((track, idx) => {
        const isCurrent = currentTrack?.id === track.id;
        const cached = cachedMap[track.id];
        const downloaded = Boolean(cached?.blobData);
        return (
          <li
            key={track.id}
            onClick={() => onPlay(track, tracks)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
              isCurrent ? "bg-[#d4a373]/10" : "hover:bg-[#1d1a16]"
            }`}
          >
            <span className="w-6 text-center text-xs text-[#6b635a] tabular-nums">
              {idx + 1}
            </span>
            {isCurrent && isPlaying ? (
              <Play size={14} className="text-[#d4a373]" />
            ) : (
              <Music size={14} className="text-[#a3978b]" />
            )}
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
  );
}