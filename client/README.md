# Neko Drive Client

React frontend for Neko Drive. File management UI with upload, download, preview, and encryption.

## Features

- **File list** with search, sort by name/size/date, pagination
- **Upload** via drag-and-drop or file picker, with encrypted/standard mode toggle
- **Download** with chunked transfer and progress tracking
- **Preview** images, video, audio, PDF, and text files inline
- **Encryption** using AES-256-GCM via a Web Worker — key stays client-side
- **Trash** with soft delete, restore, and empty trash
- **Transfer widget** floating progress bar for active uploads/downloads
- **Dark/light/system theme** using Catppuccin Mocha/Latte palette

## Project layout

```
src/
├── components/
│   ├── layout/AppLayout.tsx      # Shell layout (sidebar + header + content)
│   ├── settings/SettingsDialog.tsx
│   ├── ui/                       # shadcn components
│   ├── FileList.tsx              # Main file listing
│   ├── FileActions.tsx           # File context menu
│   ├── FilePreviewModal.tsx      # Inline preview dialog
│   ├── UploadWidget.tsx          # Upload dialog
│   ├── TransferWidget.tsx        # Bottom progress bar
│   ├── Sidebar.tsx               # Navigation + storage stats
│   ├── DropZone.tsx              # Global drag-and-drop overlay
│   ├── DeleteFileDialog.tsx
│   ├── EmptyTrashDialog.tsx
│   ├── RenameFileDialog.tsx
│   └── ErrorBoundary.tsx
├── hooks/
│   ├── use-files.ts              # File list query
│   ├── use-upload.ts             # Upload orchestration
│   ├── use-download.ts           # Download/preview orchestration
│   └── useSystemHealth.ts        # Health and stats queries
├── lib/
│   ├── api.ts                    # HTTP client (GET/POST/PATCH/DELETE)
│   ├── transfer-manager.ts       # Core upload/download chunking logic
│   ├── worker.ts                 # Web Worker message helpers
│   ├── file-utils.tsx            # File type detection, icons
│   ├── utils.ts                  # cn(), formatBytes(), formatRelativeDate()
│   └── query.ts                  # TanStack Query config
├── workers/
│   └── processor.worker.ts       # AES-256-GCM encrypt/decrypt worker
└── types/
    └── index.ts                  # Shared TypeScript types
```

## Environment

```env
VITE_API_URL=http://localhost:3000/api
VITE_API_SECRET=your_api_secret
VITE_MASTER_KEY=your_master_password
```

`VITE_MASTER_KEY` is used for client-side encryption. It's passed to the Web Worker for AES-256-GCM key derivation. Without it, encrypted uploads and previews won't work.

## Scripts

```bash
bun dev          # Start Vite dev server
bun build        # TypeScript check + production build
bun test         # Run tests with Bun
bun run preview  # Preview production build
```
