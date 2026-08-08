import { Download, HardDrive, RefreshCw } from "lucide-react";
import ApiKeyManager from "./components/ApiKeyManager";
import CsvUploader from "./components/CsvUploader";
import PlayerBar from "./components/PlayerBar";
import PlaylistCard from "./components/PlaylistCard";
import Sidebar from "./components/Sidebar";
import SongUploader from "./components/SongUploader";
import TrackList from "./components/TrackList";
import { useApiKeys } from "./hooks/useApiKeys";
import { useLibrary } from "./hooks/useLibrary";
import { usePlayer } from "./hooks/usePlayer";
import { useState } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState("library");

  const library = useLibrary();
  const player = usePlayer({ cacheTrack: library.cacheTrack });
  const { apiKeys, addKey, copyKey, revokeKey } = useApiKeys();

  const cachedMap = Object.fromEntries(
    library.idbTracks.map((t) => [t.id, t])
  );

  return (
    <div className="min-h-screen bg-[#141210] text-[#e8dfd1] font-sans flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        playlists={library.playlists}
        activePlaylistId={library.activePlaylist?.id}
        setActivePlaylistId={library.setActivePlaylistId}
        idbTracks={library.idbTracks}
        onCreatePlaylist={library.createPlaylist}
        onMovePlaylist={library.movePlaylist}
      />

      <main className="flex-1 p-6 pb-32 overflow-auto">
        {activeTab === "library" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#d4a373]">Your Library</h2>
              <button
                onClick={() => library.loadIndexedDB?.()}
                className="flex items-center gap-2 text-xs text-[#a3978b] hover:text-[#d4a373]"
              >
                <RefreshCw size={14} /> Sync
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {library.playlists.map((pl) => (
                <PlaylistCard
                  key={pl.id}
                  playlist={pl}
                  isActive={library.activePlaylist?.id === pl.id}
                  onSelect={() => library.setActivePlaylistId(pl.id)}
                  onPlay={() =>
                    player.playTrack(pl.tracks[0], pl.tracks)
                  }
                  onAddToQueue={() =>
                    player.playTrack(pl.tracks[0], pl.tracks)
                  }
                  onDelete={() => library.removePlaylist(pl.id)}
                />
              ))}
            </div>
          </section>
        )}

        {activeTab === "stream" && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold text-[#d4a373]">Live Stream</h2>
            <CsvUploader
              isUploading={library.isUploading}
              uploadProgress={library.uploadProgress}
              onUpload={library.handleCsvUpload}
            />

            <SongUploader
              playlists={library.playlists}
              activePlaylistId={library.activePlaylist?.id}
              isUploading={library.isUploadingSongs}
              uploadProgress={library.songUploadProgress}
              onUpload={library.uploadSongs}
            />

            {library.activePlaylist && (
              <div className="border border-[#3a332b] rounded-xl bg-[#1d1a16] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[#e8dfd1]">
                    {library.activePlaylist.title}
                  </h3>
                  <div className="flex items-center gap-3">
                    {library.downloadProgress && (
                      <span className="text-xs text-[#a3978b]">
                        Downloading {library.downloadProgress.done + 1}/
                        {library.downloadProgress.total}:{" "}
                        {library.downloadProgress.current.slice(0, 24)}…
                      </span>
                    )}
                    <button
                      onClick={() =>
                        library.downloadTracks(library.activePlaylist.tracks)
                      }
                      disabled={Boolean(library.downloadProgress)}
                      className="flex items-center gap-2 rounded-lg bg-[#d4a373] text-[#141210] text-xs font-semibold px-3 py-2 disabled:opacity-50"
                    >
                      <Download size={14} /> Download all
                    </button>
                  </div>
                </div>
                {library.downloadProgress && (
                  <div className="h-1.5 bg-[#3a332b] rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-[#d4a373] transition-all"
                      style={{
                        width: `${(library.downloadProgress.done / library.downloadProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                )}
                <TrackList
                  tracks={library.activePlaylist.tracks}
                  currentTrack={player.currentTrack}
                  isPlaying={player.isPlaying}
                  onPlay={player.playTrack}
                  cachedMap={cachedMap}
                  onDeleteSelected={library.deleteTracks}
                />
              </div>
            )}
          </section>
        )}

        {activeTab === "keys" && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold text-[#d4a373]">API Keys</h2>
            <ApiKeyManager
              apiKeys={apiKeys}
              copyKey={copyKey}
              onAdd={addKey}
              onRevoke={revokeKey}
            />
          </section>
        )}

        {activeTab === "storage" && (
          <section className="space-y-6">
            <h2 className="text-xl font-bold text-[#d4a373]">
              Browser Storage (IndexedDB)
            </h2>
            <div className="flex items-center gap-3 border border-[#3a332b] rounded-xl bg-[#1d1a16] p-5">
              <HardDrive size={20} className="text-[#d4a373]" />
              <div>
                <p className="text-sm text-[#e8dfd1]">
                  {library.idbStorageUsed} cached
                </p>
                <p className="text-xs text-[#a3978b]">
                  {library.idbTracks.length} tracks stored ·{" "}
                  {library.isSyncingIDB ? "syncing…" : "offline-ready"}
                </p>
              </div>
            </div>
            <TrackList
              tracks={library.idbTracks}
              currentTrack={player.currentTrack}
              isPlaying={player.isPlaying}
              onPlay={player.playTrack}
              cachedMap={cachedMap}
              onDeleteSelected={library.deleteTracks}
            />
          </section>
        )}
      </main>

      <PlayerBar
        audioRef={player.audioRef}
        currentTrack={player.currentTrack}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        togglePlay={player.togglePlay}
        skip={player.skip}
        onTimeUpdate={player.onTimeUpdate}
        onLoadedMetadata={player.onLoadedMetadata}
        setVolumeLevel={player.setVolumeLevel}
      />
    </div>
  );
}