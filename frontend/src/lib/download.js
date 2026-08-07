import { API_BASE } from "../config";

export async function fetchTrackAudio(track) {
  const res = await fetch(`${API_BASE}/stream/proxy/${track.id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = v >= 100 || i === 0 ? 0 : 1;
  return `${v.toFixed(digits)} ${units[i]}`;
}