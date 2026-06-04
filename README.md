# Neko Drive

A multi-cloud storage engine that uses Discord as a storage backend. Files are split into encrypted chunks, stored across Discord's CDN, and indexed locally in SQLite.

## How it works

When you upload a file, it gets split into 8MB chunks. Each chunk is encrypted with AES-256-GCM in your browser before being sent to Discord as a message attachment. The server keeps track of where each chunk lives — which channel, which message, and the CDN URL — in a local SQLite database.

When you download or preview a file, the chunks are fetched from Discord, decrypted in your browser, and reassembled. For unencrypted files (standard mode), the server streams data directly with range request support.

Encryption is fully client-side. The master key never leaves your browser, so the server never sees your file contents.

## What's inside

**Backend** — Bun + Hono + SQLite
- File metadata and search index (FTS5)
- Chunked upload/download with resume support
- Range-request streaming for media preview
- Discord API integration for storage
- Rate limiting, input validation, graceful shutdown

**Frontend** — React 19 + Vite + Tailwind CSS v4
- File list with search, sort, pagination
- Upload with drag-and-drop, encryption toggle
- Preview for images, video, audio, PDF, text
- Transfer progress widget
- Dark/light/system theme (Catppuccin palette)

## Getting started

You'll need:
- Bun v1.2+
- A Discord bot token and channel ID

```bash
# Install dependencies
cd server && bun install
cd client && bun install

# Configure
cp server/.env.example server/.env
# Edit server/.env with your Discord bot token and channel IDs
cp client/.env.example client/.env
# Edit client/.env with your API secret and master key

# Run both server and client
bun run dev
```

The client runs on `http://localhost:5173`, the server on `http://localhost:3000`.

## Running tests

```bash
cd client && bun test        # 25 tests
cd server && bun test        # 9 tests (requires server running)
```

## Project structure

```
neko-drive/
├── client/          # React frontend
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # React hooks
│       ├── lib/          # Utilities, API client, worker helpers
│       ├── workers/      # Encryption web worker
│       └── types/        # TypeScript types
├── server/          # Bun backend
│   └── src/
│       ├── routes/       # API endpoints
│       ├── lib/          # Discord helpers, backup, logger
│       ├── db/           # SQLite schema and setup
│       └── tests/        # Integration tests
└── package.json     # Root orchestration
```

## Notes

This project is for learning purposes. Discord's Terms of Service may restrict using their platform as a file storage backend. Use at your own risk.
