# VinylCloud — Live Streamer & Browser Caching

A music streaming platform: import Spotify playlists via CSV, resolve each track
to a free stream, cache audio into the browser via IndexedDB, and manage
streaming API keys.

## Project structure

```
vinylcloud/
├── backend/                 # FastAPI + MongoDB (Motor)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       ├── main.py          # App factory, CORS, router mounting, lifespan
│       ├── core/            # config + database (Mongo client)
│       ├── models/          # Track, Playlist, ApiKeyItem (pydantic)
│       ├── routers/         # playlists, api-keys, streaming
│       ├── services/        # CSV import + audio resolution
│       └── seed/            # mock data used to seed MongoDB
└── frontend/                # React (Create React App)
    ├── package.json
    ├── public/
    └── src/
        ├── index.js         # Entry point
        ├── App.jsx          # Layout + tab routing
        ├── config.js        # Backend URL
        ├── api/client.js    # Axios wrapper
        ├── lib/indexedDB.js # Browser cache helpers
        ├── mock/            # Fallback playlist data
        ├── hooks/           # usePlayer, useLibrary, useApiKeys
        └── components/      # Sidebar, PlayerBar, etc.
```

## Backend

```bash
cd backend
cp .env.example .env   # set MONGO_URL and DB_NAME

# Run with uv:
uv run python -m app                 # starts uvicorn with --reload on :8000
# or: uv run uvicorn app.main:app --reload

# First-time setup (installs deps into backend/.venv):
uv sync
```

Docs at http://localhost:8000/docs.

## Frontend

```bash
cd frontend
npm install
npm run dev          # dev server on http://localhost:5173
npm run build        # production build into dist/
```

The Vite dev server proxies `/api` to the backend at `http://localhost:8000`
(see `vite.config.js`), so no backend URL needs to be hardcoded. To point at a
different backend, set `VITE_BACKEND_URL` in `.env.local`.

Tailwind is loaded via CDN in `index.html` for convenience — swap in a
proper build pipeline if you prefer.

## Endpoints

| Method | Path                        | Purpose                          |
| ------ | --------------------------- | -------------------------------- |
| GET    | `/api/status`               | Health check (DB reachability)   |
| GET    | `/api/playlists`            | List playlists                   |
| POST   | `/api/playlists/upload-csv` | Import a Spotify CSV             |
| POST   | `/api/playlists/{id}/tracks/upload` | Upload audio files into a playlist (stored in GridFS) |
| GET    | `/api/stream/file/{id}`     | Stream an uploaded file (Range support) |
| GET    | `/api/stream/proxy/{id}`    | Stream/proxy a track's audio     |
| DELETE | `/api/playlists/{id}`       | Remove a playlist                |
| GET    | `/api/api-keys`             | List streaming API keys          |
| POST   | `/api/api-keys`             | Create an API key                |

### Downloading songs
Every song can be downloaded into browser storage (IndexedDB). Import a CSV or
upload your own audio files ("Upload your own songs" area), and each track is
fetched through the streaming proxy as a real audio blob and cached offline.
User-uploaded files are stored server-side in MongoDB GridFS and streamed with
Range support.