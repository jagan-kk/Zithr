# VinylCloud — Live Streamer & Browser Caching

A music streaming platform: import Spotify playlists via CSV, resolve each track
to a free stream, cache audio into the browser via IndexedDB, and expose the
playlists + streams to other apps through a key-protected public API.

## Project structure

```
vinylcloud/
├── backend/                 # FastAPI + MongoDB (Motor), publicly deployable
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       ├── main.py          # App factory, CORS, router mounting, key seeding
│       ├── core/
│       │   ├── config.py    # Settings (MONGO_URL, DB_NAME, CORS_ORIGINS, INIT_API_KEY)
│       │   ├── database.py  # Mongo client, GridFS bucket
│       │   └── auth.py      # require_api_key dependency (header/Bearer/?key=)
│       ├── models/          # Track, Playlist, ApiKeyItem (pydantic)
│       ├── routers/         # playlists, api-keys, streaming
│       └── services/        # CSV import + Internet Archive resolution
└── frontend/                # React + Vite
    ├── package.json
    └── src/
        ├── index.js         # Entry point
        ├── App.jsx          # Layout + tab routing
        ├── config.js        # Backend URL + API key
        ├── api/client.js    # Axios wrapper (sends X-Api-Key)
        ├── lib/indexedDB.js # Browser cache helpers
        ├── hooks/           # usePlayer, useLibrary, useApiKeys
        └── components/      # Sidebar, PlayerBar, ApiKeyManager, ...
```

## Backend (local)

```bash
cd backend
cp .env.example .env   # set MONGO_URL (Atlas) and DB_NAME
uv run python -m app   # uvicorn with --reload on :8000
```

Interactive docs at http://localhost:8000/docs. Health check:
`GET /api/status` (public — used by uptime monitors).

## Frontend (local)

```bash
cd frontend
npm install
cp .env.example .env.local   # set VITE_BACKEND_URL and VITE_API_KEY
npm run dev                  # http://localhost:5173
npm run build                # production build into dist/
```

The app authenticates as a normal API client: `VITE_API_KEY` is sent as an
`X-Api-Key` header on every request, and the player includes it in the audio
URL's `?key=` query param so a plain `<audio>` element can stream.

## Authentication

Every `/api` endpoint except `GET /api/status` and `/` requires a valid API
key. Keys are managed in the app's **API Keys** tab (create, copy, revoke) or
via `POST /api/api-keys` / `DELETE /api/api-keys/{id}`.

A key can be sent three ways:

| Transport | Example |
| --------- | ------- |
| Header    | `X-Api-Key: vcs_live_…` |
| Bearer    | `Authorization: Bearer vcs_live_…` |
| Query     | `?key=vcs_live_…` (for `<audio>` / image embeds) |

On a brand-new database, set `INIT_API_KEY=vcs_live_…` in the backend `.env`
to seed the first key (used once; ignored once any key exists). Set the same
value as the frontend's `VITE_API_KEY`.

> Note: the query-string form shows up in access logs and URLs. Treat a key as
> an access token — revoke it from the UI if it leaks.

## Using the API from your own apps

Everything you need for "give a key, show a playlist, play the songs":

```bash
# List playlists
curl -H "X-Api-Key: $KEY" https://api.example.com/api/playlists

# One playlist + its tracks
curl -H "X-Api-Key: $KEY" https://api.example.com/api/playlists/<playlist_id>
```

```js
// fetch — header or Bearer
const res = await fetch("https://api.example.com/api/playlists", {
  headers: { "X-Api-Key": "vcs_live_…" },
});
const playlists = await res.json();
```

```html
<!-- Stream a track with a plain <audio> tag (query-param auth) -->
<audio controls
  src="https://api.example.com/api/stream/proxy/<track_id>?key=vcs_live_…">
</audio>
```

Audio URLs are proxied, cached, and Range-capable, so seeking works. Tracks
imported from CSV resolve their real audio lazily — calling the stream URL is
what triggers resolution (see "Downloading songs" below).

## Endpoints

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/api/status` | — | Health check (DB reachability) |
| GET | `/api/playlists` | key | List playlists |
| GET | `/api/playlists/{id}` | key | One playlist with its tracks |
| POST | `/api/playlists` | key | Create an empty playlist |
| POST | `/api/playlists/upload-csv` | key | Import a Spotify CSV |
| POST | `/api/playlists/{id}/tracks/upload` | key | Upload audio files (GridFS) |
| GET | `/api/stream/file/{id}` | key | Stream an uploaded file (Range) |
| GET | `/api/stream/proxy/{id}` | key | Stream/proxy a track's audio |
| DELETE | `/api/playlists/tracks` | key | Delete tracks + free GridFS |
| DELETE | `/api/playlists/{id}` | key | Delete a playlist |
| GET | `/api/api-keys` | key | List API keys |
| POST | `/api/api-keys` | key | Create an API key |
| DELETE | `/api/api-keys/{id}` | key | Revoke an API key |

## Deploying publicly (Render/Railway + Vercel)

The backend is a self-contained Docker image and MongoDB is already external
(Atlas), so the API server is stateless and easy to host.

1. **Backend on Render** (or Railway):
   - Push `backend/` to GitHub; create a **Web Service** → *Root directory* = `backend` (Render picks up the `Dockerfile`).
   - Env vars: `MONGO_URL` (Atlas URI), `DB_NAME`, `CORS_ORIGINS=*`, and `INIT_API_KEY` on first launch.
   - You get `https://vinylcloud.onrender.com`. HTTPS is automatic.
   - *Free-tier caveat:* Render sleeps after ~15 min idle, so the first request can be slow.

2. **Frontend on Vercel**:
   - Build command `npm run build`, output dir `dist`.
   - Env vars: `VITE_BACKEND_URL=https://vinylcloud.onrender.com`, `VITE_API_KEY=<your key>`.

3. Generate a dedicated key for external apps in the **API Keys** tab and hand
   that out (not the app's own key). Revoke it there if you want to cut access.

## Downloading songs

Every song can be downloaded into browser storage (IndexedDB). Import a CSV or
upload your own audio files ("Upload your own songs" area), and each track is
fetched through the streaming proxy as a real audio blob and cached offline.
User-uploaded files are stored server-side in MongoDB GridFS and streamed with
Range support.

CSV-imported tracks are **resolved lazily**: importing is instant (no network
calls), and each track's real audio is resolved from **Internet Archive** the
first time you play or download it (search -> metadata -> validated live file,
cached afterwards). Matches play/download as real music; tracks with no
Archive.org recording show "No audio source".

Create an empty playlist with the **+** button beside "Your Playlists" in the
sidebar, then upload songs into it directly — no CSV needed.

Select tracks (checkbox) in any playlist or the Storage tab, then **Delete** to
remove them from the library AND free their GridFS/browser storage.