const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
export const API_BASE = `${BACKEND_URL}/api`;

const API_KEY = import.meta.env.VITE_API_KEY || "";
export { API_KEY };

export function streamUrlFor(trackId) {
  if (!trackId) return "";
  const base = `${API_BASE}/stream/proxy/${trackId}`;
  return API_KEY ? `${base}?key=${encodeURIComponent(API_KEY)}` : base;
}