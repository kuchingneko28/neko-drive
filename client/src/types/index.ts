export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "pending" | "active" | "trashed";
  chunks: number;
  iv: string | null;
  salt: string | null;
  createdAt: number;
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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface SystemStats {
  storage: {
    totalFiles: number;
    totalSize: number;
  };
  encryptedFiles: number;
  standardFiles: number;
  totalChunks: number;
  avgFileSize: number;
  trashedFiles: number;
  dbSize: number;
}
