import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Database,
  Disc,
  Home,
  Key,
  Layers,
  Plus,
  Radio,
  X,
} from "lucide-react";

const NAV = [
  { id: "welcome", label: "Welcome", icon: Home },
  { id: "library", label: "Library", icon: Disc },
  { id: "stream", label: "Live Stream", icon: Radio },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "storage", label: "Storage", icon: Database },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  playlists,
  activePlaylistId,
  setActivePlaylistId,
  idbTracks,
  onCreatePlaylist,
  onMovePlaylist,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const res = await onCreatePlaylist?.(newName);
    if (res) {
      setNewName("");
      setCreating(false);
    }
  };

  return (
    <aside className="w-64 shrink-0 border-r border-[#3a332b] h-screen overflow-y-auto sticky top-0 flex flex-col">
      <h1 className="flex items-center gap-2 text-lg font-bold text-[#d4a373] p-4">
        <Layers size={20} /> VinylCloud
      </h1>

      <nav className="px-3 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
              activeTab === id
                ? "bg-[#d4a373]/15 text-[#d4a373]"
                : "text-[#a3978b] hover:bg-[#1d1a16]"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      <div className="mt-6 px-3 flex-1">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="text-xs uppercase tracking-wider text-[#6b635a]">Your Playlists</p>
          <button
            onClick={() => setCreating((v) => !v)}
            aria-label="New playlist"
            className="text-[#a3978b] hover:text-[#d4a373]"
          >
            {creating ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {creating && (
          <form onSubmit={submit} className="px-3 pb-2 flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name"
              className="w-full rounded-lg bg-[#141210] border border-[#3a332b] px-2 py-1.5 text-sm text-[#e8dfd1] placeholder-[#6b635a] focus:outline-none focus:border-[#d4a373]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#d4a373] text-[#141210] text-xs font-semibold px-2 py-1.5"
            >
              Add
            </button>
          </form>
        )}

        <div className="space-y-1">
          {playlists.map((pl, i) => (
            <div
              key={pl.id}
              className={`group flex items-center rounded-lg pr-1 ${
                activePlaylistId === pl.id
                  ? "bg-[#d4a373]/15"
                  : "hover:bg-[#1d1a16]"
              }`}
            >
              <button
                onClick={() => {
                  setActivePlaylistId(pl.id);
                  setActiveTab("library");
                }}
                className={`flex-1 min-w-0 flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm ${
                  activePlaylistId === pl.id
                    ? "text-[#e8dfd1]"
                    : "text-[#a3978b]"
                }`}
              >
                <span className="truncate">{pl.title}</span>
                <span className="text-xs text-[#6b635a]">{pl.track_count}</span>
              </button>
              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onMovePlaylist?.(pl.id, "up")}
                  disabled={i === 0}
                  aria-label={`Move ${pl.title} up`}
                  title="Move up"
                  className="p-1 rounded text-[#6b635a] hover:text-[#d4a373] disabled:opacity-30 disabled:hover:text-[#6b635a]"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => onMovePlaylist?.(pl.id, "down")}
                  disabled={i === playlists.length - 1}
                  aria-label={`Move ${pl.title} down`}
                  title="Move down"
                  className="p-1 rounded text-[#6b635a] hover:text-[#d4a373] disabled:opacity-30 disabled:hover:text-[#6b635a]"
                >
                  <ArrowDown size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-[#3a332b] text-xs text-[#6b635a]">
        IndexedDB tracks: <span className="text-[#d4a373]">{idbTracks.length}</span>
      </div>
    </aside>
  );
}