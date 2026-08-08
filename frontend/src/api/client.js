import axios from "axios";
import { API_BASE, API_KEY } from "../config";

const api = axios.create({ baseURL: API_BASE });
if (API_KEY) api.defaults.headers.common["X-Api-Key"] = API_KEY;

export const getPlaylists = () => api.get("/playlists").then((r) => r.data);

export const createPlaylist = (name) =>
  api.post("/playlists", { name }).then((r) => r.data);

export const uploadCsv = (formData) =>
  api.post("/playlists/upload-csv", formData).then((r) => r.data);

export const uploadSongFiles = (playlistId, files, artist, onProgress) => {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  if (artist) formData.append("artist", artist);
  return api
    .post(`/playlists/${playlistId}/tracks/upload`, formData, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / e.total) * 100)),
    })
    .then((r) => r.data);
};

export const deletePlaylist = (id) =>
  api.delete(`/playlists/${id}`).then((r) => r.data);

export const reorderPlaylists = (ids) =>
  api.post("/playlists/reorder", { ids }).then((r) => r.data);

export const deleteTracks = (trackIds) =>
  api
    .delete("/playlists/tracks", { data: { track_ids: trackIds } })
    .then((r) => r.data);

export const getApiKeys = () => api.get("/api-keys").then((r) => r.data);

export const createApiKey = (name) =>
  api.post("/api-keys", new URLSearchParams({ name })).then((r) => r.data);

export const deleteApiKey = (id) =>
  api.delete(`/api-keys/${id}`).then((r) => r.data);

export const getStreamInfo = (trackId) =>
  api.get(`/stream/proxy/${trackId}`).then((r) => r.data);