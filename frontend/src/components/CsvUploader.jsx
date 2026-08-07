import { useRef, useState } from "react";
import { Cloud, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

export default function CsvUploader({ isUploading, uploadProgress, onUpload }) {
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(false);
  const fileRef = useRef(null);

  const pickFile = () => {
    // Explicitly forward the click: more reliable than relying on label wrapping.
    fileRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileName(file?.name || null);
    setFileError(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFileError(true);
      toast.error("Choose a .csv file first.");
      return;
    }
    onUpload(file, title);
    setTitle("");
  };

  return (
    <div className="border border-[#3a332b] rounded-xl bg-[#1d1a16] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Cloud size={18} className="text-[#d4a373]" />
        <h3 className="font-semibold text-[#e8dfd1]">Import Spotify Playlist</h3>
      </div>
      <p className="text-xs text-[#6b635a] mb-4">
        Upload a Spotify-exported CSV. We resolve each track to a free stream and
        cache it into browser IndexedDB.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs text-[#a3978b]">
          Playlist name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Imported Playlist"
            className="mt-1 w-full rounded-lg bg-[#141210] border border-[#3a332b] px-3 py-2 text-sm text-[#e8dfd1] placeholder-[#6b635a] focus:outline-none focus:border-[#d4a373]"
          />
        </label>

        <div
          onClick={pickFile}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && pickFile()}
          className={`flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm cursor-pointer hover:border-[#d4a373] transition ${
            fileError ? "border-red-500 text-red-300" : "border-[#3a332b] text-[#a3978b]"
          }`}
        >
          {fileName ? (
            <FileText size={16} className="text-[#d4a373]" />
          ) : (
            <Upload size={16} />
          )}
          <span className="truncate">
            {fileName || (fileError ? "No file chosen — try again" : "Choose .csv file")}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
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
          className="w-full rounded-lg bg-[#d4a373] text-[#141210] font-semibold py-2 text-sm disabled:opacity-50"
        >
          {isUploading ? "Importing & caching..." : "Import & Cache"}
        </button>
      </form>
    </div>
  );
}