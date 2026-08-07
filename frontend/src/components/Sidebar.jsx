import { Database, Disc, Key, Layers, Radio } from "lucide-react";

const NAV = [
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
}) {
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
        <p className="px-3 text-xs uppercase tracking-wider text-[#6b635a] mb-2">
          Your Playlists
        </p>
        <div className="space-y-1">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => {
                setActivePlaylistId(pl.id);
                setActiveTab("library");
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm ${
                activePlaylistId === pl.id
                  ? "bg-[#d4a373]/15 text-[#e8dfd1]"
                  : "text-[#a3978b] hover:bg-[#1d1a16]"
              }`}
            >
              <span className="truncate">{pl.title}</span>
              <span className="text-xs text-[#6b635a]">{pl.track_count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-[#3a332b] text-xs text-[#6b635a]">
        IndexedDB tracks: <span className="text-[#d4a373]">{idbTracks.length}</span>
      </div>
    </aside>
  );
}