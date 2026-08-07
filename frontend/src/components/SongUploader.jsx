import { useRef, useState } from "react";
import { Disc, FolderUp, Music, Upload } from "lucide-react";
import { toast } from "sonner";

export default function SongUploader({
  playlists,
  activePlaylistId,
  isUploading,
  uploadProgress = 0,
  onUpload,
}) {
  const [targetId, setTargetId] = useState(activePlaylistId || playlists[0]?.id || "");
  const [artist, setArtist] = useState("");
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState(false);
  const fileRef = useRef(null);

  const handleChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setFileError(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setFileError(true);
      toast.error("Choose one or more audio files first.");
      return;
    }
    if (!targetId) {
      toast.error("Pick a playlist to add the songs to.");
      return;
    }
    onUpload(targetId, files, artist);
    setFiles([]);
    setArtist("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border border-[#3a332b] rounded-xl bg-[#1d1a16] p-5">
      <div className="flex items-center gap-2 mb-1">
        <FolderUp size={18} className="text-[#d4a373]" />
        <h3 className="font-semibold text-[#e8dfd1]">Upload your own songs</h3>
      </div>
      <p className="text-xs text-[#6b635a] mb-4">
        Add audio files straight from your computer. They're stored server-side
        and cached into browser storage so you can play them offline.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-[#a3978b]">
            Add to playlist
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#141210] border border-[#3a332b] px-3 py-2 text-sm text-[#e8dfd1] focus:outline-none focus:border-[#d4a373]"
            >
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[#a3978b]">
            Artist (optional)
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name"
              className="mt-1 w-full rounded-lg bg-[#141210] border border-[#3a332b] px-3 py-2 text-sm text-[#e8dfd1] placeholder-[#6b635a] focus:outline-none focus:border-[#d4a373]"
            />
          </label>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-6 text-sm cursor-pointer transition ${
            fileError
              ? "border-red-500 text-red-300"
              : "border-[#3a332b] text-[#a3978b] hover:border-[#d4a373]"
          }`}
        >
          <Music size={20} />
          <span className="text-[#e8dfd1]">
            {files.length > 0
              ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
              : "Click to choose audio files"}
          </span>
          <span className="text-xs text-[#6b635a]">
            {fileError
              ? "No files chosen — try again"
              : files.map((f) => f.name).join(", ") || "MP3 · WAV · OGG · M4A · FLAC"}
          </span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
            className="hidden"
            onChange={handleChange}
          />
        </div>

        {isUploading && (
          <div className="h-2 bg-[#3a332b] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#d4a373] transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="w-full rounded-lg bg-[#d4a373] text-[#141210] font-semibold py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Upload size={16} />
          {isUploading ? "Uploading & caching…" : "Upload songs"}
        </button>
      </form>
    </div>
  );
}