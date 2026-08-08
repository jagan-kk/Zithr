import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createPlaylist as apiCreatePlaylist,
  deletePlaylist,
  deleteTracks as apiDeleteTracks,
  getPlaylists,
  reorderPlaylists,
  uploadCsv,
  uploadSongFiles,
} from "../api/client";
import {
  deleteIndexedDBTracks,
  getAllIndexedDBTracks,
  getIndexedDBTrack,
  storeTrackInIndexedDB,
} from "../lib/indexedDB";
import { fetchTrackAudio, formatBytes } from "../lib/download";
import { MOCK_PLAYLISTS } from "../mock/playlists";

export function useLibrary() {
  const [playlists, setPlaylists] = useState(MOCK_PLAYLISTS);
  const [activePlaylistId, setActivePlaylistId] = useState(MOCK_PLAYLISTS[0]?.id);

  const [idbTracks, setIdbTracks] = useState([]);
  const [idbStorageUsed, setIdbStorageUsed] = useState("0 B");
  const [idbUsageBytes, setIdbUsageBytes] = useState(0);
  const [idbQuota, setIdbQuota] = useState("");
  const [idbQuotaBytes, setIdbQuotaBytes] = useState(0);
  const [isSyncingIDB, setIsSyncingIDB] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isUploadingSongs, setIsUploadingSongs] = useState(false);
  const [songUploadProgress, setSongUploadProgress] = useState(0);

  const [downloadProgress, setDownloadProgress] = useState(null);

  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) || playlists[0];

  const refreshIDBStats = useCallback(async () => {
    const all = await getAllIndexedDBTracks();
    setIdbTracks(all);
    const totalBytes = all.reduce((sum, t) => sum + (t.blobData?.size || 0), 0);
    setIdbStorageUsed(formatBytes(totalBytes));
    setIdbUsageBytes(totalBytes);
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (est?.quota) {
          setIdbQuota(formatBytes(est.quota));
          setIdbQuotaBytes(est.quota);
        }
      }
    } catch (e) {
      console.warn("Storage quota estimate failed:", e);
    }
    return all;
  }, []);

  const syncFromServer = useCallback(async () => {
    try {
      const serverPlaylists = await getPlaylists();
      setPlaylists((prev) =>
        JSON.stringify(prev) === JSON.stringify(serverPlaylists) ? prev : serverPlaylists
      );
      return serverPlaylists;
    } catch (e) {
      console.error("Server sync failed, using mock data:", e);
      return [];
    }
  }, []);

  const loadIndexedDB = useCallback(async () => {
    setIsSyncingIDB(true);
    const cached = await getAllIndexedDBTracks();
    if (cached.length === 0) {
      for (const pl of MOCK_PLAYLISTS) {
        for (const t of pl.tracks) {
          await storeTrackInIndexedDB(t, null);
        }
      }
    }
    await refreshIDBStats();
    setIsSyncingIDB(false);
  }, [refreshIDBStats]);

  useEffect(() => {
    loadIndexedDB();
    syncFromServer();
  }, [loadIndexedDB, syncFromServer]);

  const downloadTracks = useCallback(
    async (tracks, { auto = false } = {}) => {
      const pending = [];
      for (const t of tracks) {
        if (!t || t.audio_url?.includes("samplelib.com")) continue;
        const existing = await getIndexedDBTrack(t.id);
        if (!existing?.blobData) pending.push(t);
      }
      if (pending.length === 0) {
        if (!auto) toast.info("Every song in this playlist is already downloaded.");
        return { downloaded: 0, pending: 0 };
      }
      setDownloadProgress({ done: 0, total: pending.length, current: pending[0].title });

      let ok = 0;
      const CONCURRENCY = 3;
      let next = 0;
      const worker = async () => {
        while (next < pending.length) {
          const i = next;
          next += 1;
          const t = pending[i];
          setDownloadProgress({ done: i, total: pending.length, current: t.title });
          try {
            const blob = await fetchTrackAudio(t);
            await storeTrackInIndexedDB(
              { ...t, file_size: formatBytes(blob.size) },
              blob
            );
            ok += 1;
          } catch (err) {
            console.error(`Failed to download "${t.title}":`, err);
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker())
      );
      await refreshIDBStats();
      setDownloadProgress(null);
      if (ok > 0) {
        toast.success(`Downloaded ${ok}/${pending.length} songs into browser storage.`);
      } else {
        toast.error("Could not download any songs from this playlist.");
      }
      return { downloaded: ok, total: pending.length };
    },
    [refreshIDBStats]
  );

  const cacheTrack = useCallback(
    async (track) => {
      if (!track?.audio_url || track.audio_url.includes("samplelib.com")) return;
      try {
        const existing = await getIndexedDBTrack(track.id);
        if (existing?.blobData) {
          await refreshIDBStats();
          return;
        }
        const blob = await fetchTrackAudio(track);
        await storeTrackInIndexedDB({ ...track, file_size: formatBytes(blob.size) }, blob);
        await refreshIDBStats();
      } catch (e) {
        console.error("cacheTrack failed:", e);
      }
    },
    [refreshIDBStats]
  );

  const handleCsvUpload = useCallback(
    async (file, title) => {
      if (!file) {
        toast.error("Please select a Spotify CSV file.");
        return;
      }
      setIsUploading(true);
      setUploadProgress(30);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("playlist_name", title || file.name.replace(".csv", ""));

      try {
        const res = await uploadCsv(formData);
        setUploadProgress(80);
        setPlaylists((prev) => [res, ...prev]);
        setActivePlaylistId(res.id);
        setUploadProgress(100);
        toast.success(
          `Imported "${res.title}" (${res.tracks.length} tracks). Audio resolves when you play or download.`
        );
      } catch (err) {
        const detail =
          err?.response?.status === 0 || err?.message?.includes("Network")
            ? "Could not reach the backend. Is it running on port 8000?"
            : `Upload failed: ${err?.message || "unknown error"}`;
        toast.error(detail);
        console.error("Upload error:", err);
      } finally {
        setTimeout(() => setIsUploading(false), 500);
      }
    },
    []
  );

  const uploadSongs = useCallback(
    async (playlistId, files, artist) => {
      if (!playlistId || files.length === 0) return;
      setIsUploadingSongs(true);
      setSongUploadProgress(0);
      try {
        const res = await uploadSongFiles(
          playlistId,
          files,
          artist,
          setSongUploadProgress
        );
        setActivePlaylistId(playlistId);
        toast.success(
          `Uploaded ${files.length} song${files.length > 1 ? "s" : ""}. Caching audio…`
        );
        const fresh = await syncFromServer();
        const added = res.tracks.filter((t) => t.file_id);
        if (added.length) await downloadTracks(added, { auto: true });
        setSongUploadProgress(100);
      } catch (err) {
        toast.error(`Song upload failed: ${err?.message || "unknown error"}`);
        console.error("Song upload error:", err);
      } finally {
        setIsUploadingSongs(false);
      }
    },
    [syncFromServer, downloadTracks]
  );

  const removePlaylist = useCallback(async (id) => {
    try {
      await deletePlaylist(id);
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (activePlaylistId === id) {
      setActivePlaylistId(undefined);
    }
  }, [activePlaylistId]);

  const createPlaylist = useCallback(
    async (name) => {
      if (!name || !name.trim()) {
        toast.error("Enter a playlist name.");
        return null;
      }
      try {
        const res = await apiCreatePlaylist(name.trim());
        await syncFromServer();
        setActivePlaylistId(res.id);
        toast.success(`Created playlist "${res.title}".`);
        return res;
      } catch (e) {
        toast.error(`Could not create playlist: ${e?.message || "unknown error"}`);
        console.error(e);
        return null;
      }
    },
    [syncFromServer]
  );

  const movePlaylist = useCallback(
    async (id, direction) => {
      const index = playlists.findIndex((p) => p.id === id);
      if (index === -1) return;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= playlists.length) return;
      const reordered = [...playlists];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      const previous = playlists;
      setPlaylists(reordered);
      try {
        await reorderPlaylists(reordered.map((p) => p.id));
      } catch (e) {
        setPlaylists(previous);
        console.error("Reorder failed:", e);
      }
    },
    [playlists]
  );

  const deleteTracks = useCallback(
    async (trackIds) => {
      if (!trackIds || trackIds.length === 0) return;
      let serverDeleted = 0;
      try {
        const res = await apiDeleteTracks(trackIds);
        serverDeleted = res?.deleted || 0;
      } catch (e) {
        console.error("Server track delete failed:", e);
      }
      await deleteIndexedDBTracks(trackIds);
      await refreshIDBStats();
      await syncFromServer();
      toast.success(
        `Deleted ${trackIds.length} track${trackIds.length > 1 ? "s" : ""} from library and storage.`
      );
    },
    [refreshIDBStats, syncFromServer]
  );

  return {
    playlists,
    activePlaylist,
    setActivePlaylistId,
    idbTracks,
    idbStorageUsed,
    idbUsageBytes,
    idbQuota,
    idbQuotaBytes,
    isSyncingIDB,
    isUploading,
    uploadProgress,
    isUploadingSongs,
    songUploadProgress,
    downloadProgress,
    handleCsvUpload,
    uploadSongs,
    removePlaylist,
    createPlaylist,
    movePlaylist,
    deleteTracks,
    cacheTrack,
    downloadTracks,
    refreshIDBStats,
  };
}