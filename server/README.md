# Neko Drive Server

Bun + Hono backend that handles file metadata, chunk management, Discord API communication, and streaming.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/system/health` | Server and Discord connectivity check |
| GET | `/api/system/stats` | Storage statistics |
| POST | `/api/system/backup` | Trigger database backup |
| POST | `/api/upload/file/init` | Start a new file upload |
| POST | `/api/upload/file/:id/chunk` | Upload a single chunk |
| GET | `/api/upload/file/:id/chunks` | List uploaded chunk indices |
| POST | `/api/upload/file/:id/finalize` | Complete an upload |
| POST | `/api/upload/file/:id/abort` | Cancel an upload |
| DELETE | `/api/upload/file/pending/all` | Purge incomplete uploads |
| GET | `/api/files` | List files with pagination and sort |
| GET | `/api/files/search` | Full-text search |
| GET | `/api/files/:id` | File details with chunk list |
| PATCH | `/api/files/:id` | Rename a file |
| POST | `/api/files/:id/restore` | Restore from trash |
| DELETE | `/api/files/trash` | Empty trash |
| DELETE | `/api/files/:id` | Soft or hard delete |
| GET | `/api/download/:id` | Download individual chunks |
| GET | `/api/stream/file/:id` | Range-request streaming |

## Environment

See `.env.example` for all configuration options.
