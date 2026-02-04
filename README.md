# Neko Drive 🐱

**The Secure Multi-Cloud Storage Engine**

Neko Drive is a high-performance, privacy-focused storage system that leverages Discord as an infinite storage backend, featuring AES-256 E2E encryption, comprehensive system monitoring, and a premium "Modern Minimalist" UI.

## ✨ key Features

- **♾️ Infinite Cloud Storage**: Shards files into 25MB chunks and distributes them across Discord CDNs.
- **🔒 Zero-Knowledge Encryption**: All files are encrypted with AES-256-GCM before leaving the client.
- **⚡ Blazing Fast**: Streaming upload/download pipeline with no local buffering bottleneck.
- **🌐 Modern Stack**: Built with Bun, Hono, React 19, Vite, and Tailwind v4.
- **🦾 Resilience**: Automatic retries, circular database backups, and self-healing index.
- **🎨 Active UI**: Real-time health monitoring, drag & drop, and beautiful animations.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) (v1.2+)
- **Backend**: [Hono](https://hono.dev) + SQLite (Bun Native)
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **State**: TanStack Query + Context API
- **Components**: Shadcn UI + Framer Motion + Lucide React

## 🚀 Getting Started

### Prerequisites

- Bun v1.2 or higher
- A Discord Bot Token & Channel ID

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/neko-drive.git
    cd neko-drive
    ```

2.  **Install Dependencies**

    ```bash
    bun install:all
    ```

    _(This script installs dependencies for both root, client, and server)_

3.  **Configure Environment**
    Copy the example config and fill in your details:

    ```bash
    cp server/.env.example server/.env
    ```

    **Required Variables:**
    - `DISCORD_BOT_TOKEN`: Your bot token
    - `DISCORD_CHANNEL_ID`: Channel ID for file chunks
    - `API_SECRET`: A secure string for authentication

4.  **Run Development Server**

    ```bash
    bun run dev
    ```

    - Frontend: `http://localhost:5173`
    - Backend: `http://localhost:3000`

## 🛡️ Architecture

Neko Drive splits files into encrypted chunks. Metadata (pointers to chunks, IVs, Salts) is stored locally in `server/neko.db` (SQLite). The actual data lives on Discord.

- **Upload**: Stream -> Encrypt -> Chunk -> Discord -> Save Meta
- **Download**: Fetch Meta -> Fetch Chunks (Parallel) -> Decrypt -> Stream
- **Search**: FTS5 Full-Text Search on file names.

## ⚠️ Disclaimer

This project is for educational purposes only. Using Discord as a file storage system may violate their Terms of Service. Use responsibly.
