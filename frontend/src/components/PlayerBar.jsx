import {
  Download,
  HardDrive,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { streamUrlFor } from "../config";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PlayerBar({
  audioRef,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  togglePlay,
  skip,
  onTimeUpdate,
  onLoadedMetadata,
  setVolumeLevel,
}) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trackId = currentTrack?.id;
  const streamUrl = trackId ? streamUrlFor(trackId) : null;

  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#1d1a16]/95 backdrop-blur border-t border-[#3a332b] p-3 flex items-center gap-4">
      <audio
        ref={audioRef}
        src={streamUrl || ""}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
      />

      {currentTrack ? (
        <div className="w-64 min-w-0">
          <p className="text-sm font-semibold text-[#e8dfd1] truncate">{currentTrack.title}</p>
          <p className="text-xs text-[#a3978b] truncate">{currentTrack.artist}</p>
        </div>
      ) : (
        <div className="w-64 text-xs text-[#6b635a] flex items-center gap-2">
          <HardDrive size={14} /> Select a track to start streaming
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => skip(-1)}
          className="text-[#a3978b] hover:text-[#d4a373]"
          aria-label="Previous track"
        >
          <SkipBack size={18} />
        </button>
        <button
          onClick={togglePlay}
          disabled={!currentTrack}
          className="bg-[#d4a373] text-[#141210] rounded-full p-3 disabled:opacity-40"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={() => skip(1)}
          className="text-[#a3978b] hover:text-[#d4a373]"
          aria-label="Next track"
        >
          <SkipForward size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2 text-xs text-[#a3978b]">
        <span className="tabular-nums">{formatTime(currentTime)}</span>
        <div className="flex-1 h-1.5 bg-[#3a332b] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d4a373] rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="tabular-nums">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-2 w-40 text-[#a3978b]">
        <Volume2 size={16} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolumeLevel(Number(e.target.value))}
          className="w-full accent-[#d4a373]"
        />
      </div>

      {currentTrack && (
        <a
          href={streamUrl || ""}
          target="_blank"
          rel="noreferrer"
          className="text-[#a3978b] hover:text-[#d4a373]"
          aria-label="Download"
        >
          <Download size={18} />
        </a>
      )}
    </div>
  );
}