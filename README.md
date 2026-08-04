# Neko Drive

A self-hosted cloud drive that uses **Discord as its storage backend**. Files are
split into encrypted chunks, stored across Discord's CDN, and indexed locally in
SQLite. The server never sees your file contents — encryption happens in the browser.

## Features

- **Client-side encryption** — AES-256-GCM, key derived with PBKDF2 (100k
  iterations) in a Web Worker pool. The master key never leaves your browser.
- **Chunked transfers** — files split into 8 MiB chunks; uploads and downloads
  resume after interruptions, with pause/cancel from a floating transfer widget.
- **Media preview** — images, video, audio, PDF and text preview with HTTP range
  streaming for unencrypted files.
- **Search** — FTS5 full-text search on the server, with sort and pagination.
- **Trash** — soft delete, restore, and empty-trash with Discord cleanup.
- **Security** — API-secret auth for writes; short-lived (1h) media tokens for
  streaming URLs so the secret never appears in them.
- **Auto-backup** — the SQLite index is snapshotted to a Discord backup channel
  after every mutation and once daily; stale (never-finalized) uploads are swept
  automatically after 24h.
- **Theme** — light/dark/system with the Catppuccin palette, Plus Jakarta Sans,
  GSAP list animations (respecting `prefers-reduced-motion`).

## How it works

```
 Browser                                   Server                        Discord
─────────                                  ──────                        ───────
 file ── split into 8 MiB chunks ──►       /api/upload/file/:id/chunk ──► attachment
        encrypt (AES-256-GCM)                                                    │
        each chunk                                                               ▼
                                                        message id + CDN url ──► SQLite
 download: chunks ──► decrypt ──► reassemble ◄── /api/download/:id (media token)
 preview :            /api/stream/file/:id    ──► range requests, inline/attachment
```

- **Upload** — the client splits the file, encrypts each chunk, and posts it to
  Discord via the server. The server records where each chunk lives
  (channel, message id, CDN URL) in SQLite.
- **Download** — the client streams chunks from Discord's CDN, decrypts them in
  a worker, and reassembles the file (or streams it to a media element).
- **Streaming** — unencrypted files are served directly with `Range` support;
  the response is `attachment` by default and `inline` for previews.

## Tech stack

| Side    | Stack                                                        |
| ------- | ------------------------------------------------------------ |
| Server  | Bun, Hono, bun:sqlite (WAL + FTS5)                           |
| Client  | React 19, Vite, Tailwind CSS v4, TanStack Query, shadcn/ui   |
| Extras  | GSAP, sonner toasts, lucide-react icons                      |

## Project layout

```
neko-drive/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components (FileList, widgets, dialogs)
│   │   ├── contexts/       # Transfer state + tab sync (BroadcastChannel)
│   │   ├── hooks/          # useFiles, useUpload, useDownload, useTheme...
│   │   ├── lib/            # api client, transfer manager, crypto workers
│   │   ├── workers/        # Encryption web worker
│   │   └── types/          # Shared TypeScript types
│   └── .env.example
├── server/                 # Bun backend
│   └── src/
│       ├── app.ts          # Hono app + middleware (test-safe, no timers)
│       ├── index.ts        # Entry: timers, graceful shutdown
│       ├── routes/         # upload, files, download, stream, system, media-token
│       ├── lib/            # Discord API, media tokens, backup, pending sweep
│       ├── db/             # SQLite schema (files, chunks, FTS5)
│       ├── tests/          # In-process API tests
│       └── .env.example
└── package.json            # Root orchestration (dev/build/start/setup)
```

## Getting started

**Prereqs:** Bun v1.2+, a Discord bot token, and two channel IDs (storage +
backup — the backup channel is optional).

```bash
# Install everything (root, server, client) and build the client
bun run setup

# Configure
cp server/.env.example server/.env   # bot token, channel ids, API secret
cp client/.env.example client/.env   # API secret + master key (must match server secret)

# Run both dev servers
bun run dev
```

The client runs on `http://localhost:5173`, the server on `http://localhost:3000`.
For production: `bun run build && bun run start` (server serves `client/dist`).

## Configuration

**Server (`.env`):**

| Variable                  | Default        | Purpose                                   |
| ------------------------- | -------------- | ----------------------------------------- |
| `PORT`                    | `3000`         | Listen port                               |
| `NODE_ENV`                | `development`  | `production` = serve built client, require API_SECRET |
| `IDLE_TIMEOUT`            | `255`          | Bun idle timeout                          |
| `API_SECRET`              | *(required)*   | Header auth for all API calls             |
| `DISCORD_BOT_TOKEN`       | *(required)*   | Bot used to store chunks                  |
| `DISCORD_CHANNEL_ID`      | *(required)*   | Primary chunk storage                     |
| `DISCORD_BACKUP_CHANNEL_ID` | *(optional)* | Backup snapshots                          |
| `STALE_PENDING_MS`        | `86400000`     | Age at which unfinished uploads get swept |

**Client (`.env`):**

| Variable           | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `VITE_API_URL`     | API base, e.g. `http://localhost:3000/api` |
| `VITE_API_SECRET`  | Must match server `API_SECRET`            |
| `VITE_MASTER_KEY`  | Passphrase for client-side encryption     |

## Scripts (root)

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `bun run dev`       | Server + client with watch mode                |
| `bun run build`     | Type-check + build the client                  |
| `bun run start`     | Run the server in production mode              |
| `bun run setup`     | Install all deps and build                     |

## API overview

All routes under `/api`, JSON in/out, `Authorization: <API_SECRET>` header:

| Method | Route                   | Purpose                              |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/upload/file/init`     | Start an upload (id, name, size, iv, salt) |
| POST   | `/upload/file/:id/chunk`| Store one encrypted chunk            |
| POST   | `/upload/file/:id/finalize` | Mark upload complete            |
| POST   | `/upload/file/:id/abort`| Cancel an upload                    |
| GET    | `/files`                | List (paginated, sortable)           |
| GET    | `/files/search?q=`      | FTS5 full-text search                |
| GET    | `/files/:id`            | Metadata + chunks                    |
| PATCH  | `/files/:id`            | Rename                               |
| DELETE | `/files/:id`            | Soft-delete (trash) or permanent     |
| DELETE | `/files/trash`          | Empty trash                          |
| GET    | `/download/:id`         | Stream whole file (resume support)   |
| GET    | `/stream/file/:id`      | Range streaming for previews         |
| GET    | `/system/stats` `/system/health` | Status + stats             |
| POST   | `/system/backup`        | Manual backup snapshot               |

## Tests

```bash
cd client && bun test        # 94 tests (utils, encryption, transfer, data integrity)
cd server && bun test        # 9 tests (in-process via Hono app.request — no live server)
```

## Notes

This project is for learning purposes. Discord's Terms of Service may restrict
using their platform as a file storage backend. Use at your own risk.
