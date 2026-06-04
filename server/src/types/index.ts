/**
 * Core Type Definitions for Neko Drive
 */

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string | null;
  iv: string | null;
  salt: string | null;
  status: "pending" | "active" | "trashed";
  created_at: number;
}

export interface ChunkMetadata {
  id: number;
  file_id: string;
  idx: number;
  message_id: string;
  channel_id: string;
  size: number;
  url?: string;
}

export interface SystemStats {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  database: "online" | "offline" | "error";
  discord: string;
  version: string;
  debug: boolean;
  storage?: {
    totalFiles: number;
    totalSize: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
