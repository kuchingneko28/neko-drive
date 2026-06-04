import type { ChunkMetadata, FileMetadata } from "../types";
import { api } from "./api";
import { isFileEncrypted } from "./file-utils";
import { createEncryptionWorker, initWorker, encryptChunk, decryptChunk } from "./worker";

const CONCURRENCY = 3;

function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  signal?: AbortSignal,
): Promise<T[]> {
  if (signal?.aborted) throw new Error("Aborted");

  return new Promise((resolve, reject) => {
    const results: T[] = new Array(tasks.length);
    let currentIndex = 0;
    let running = 0;
    let aborted = false;

    const onAbort = () => {
      aborted = true;
      reject(new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort);

    const runNext = async () => {
      if (aborted || currentIndex >= tasks.length) return;
      const index = currentIndex++;
      running++;

      try {
        results[index] = await tasks[index]();
        running--;
        if (!aborted) {
          if (currentIndex < tasks.length) runNext();
          else if (running === 0) {
            signal?.removeEventListener("abort", onAbort);
            resolve(results);
          }
        }
      } catch (err) {
        if (!aborted) {
          aborted = true;
          signal?.removeEventListener("abort", onAbort);
          reject(err);
        }
      }
    };

    for (let i = 0; i < Math.min(concurrency, tasks.length); i++) runNext();
  });
}

interface DownloadOptions {
  fileId: string;
  signal?: AbortSignal;
  sequential?: boolean;
  initialBlobs?: Blob[];
  onChunkDownloaded?: (index: number, chunk: Blob) => void;
  onProgress?: (progress: number, speed: number, eta: number) => void;
}

async function fetchAndDecryptChunk(
  worker: Worker,
  fileId: string,
  _chunk: ChunkMetadata,
  index: number,
  iv: string,
  signal?: AbortSignal,
): Promise<Blob> {
  let retries = 0;
  while (retries < 3) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/download/${fileId}?index=${index}`,
        { signal, headers: { Authorization: import.meta.env.VITE_API_SECRET || "" } },
      );
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.arrayBuffer();
      const decrypted = await decryptChunk(worker, data, index, iv);
      return new Blob([decrypted]);
    } catch (e: unknown) {
      retries++;
      if (signal?.aborted) throw new Error("Aborted");
      if (retries >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * retries));
    }
  }
  throw new Error("Failed to download chunk");
}

export async function processDownload({
  fileId,
  signal,
  sequential = false,
  initialBlobs = [],
  onChunkDownloaded,
  onProgress,
}: DownloadOptions): Promise<string> {
  const meta = await api.get<FileMetadata & { chunks: ChunkMetadata[] }>(`/files/${fileId}`);
  if (!meta) throw new Error("File metadata not found");

  const { chunks, salt, iv: fileIv } = meta;
  const encrypted = isFileEncrypted(salt, fileIv);

  if (!encrypted) {
    return `${import.meta.env.VITE_API_URL}/stream/file/${fileId}?token=${import.meta.env.VITE_API_SECRET || ""}`;
  }

  const MASTER_KEY = import.meta.env.VITE_MASTER_KEY;
  if (!MASTER_KEY) throw new Error("Missing Master Key");

  const worker = createEncryptionWorker();
  await initWorker(worker, MASTER_KEY, salt!);

  try {
    const totalChunks = chunks.length;
    const blobs: Blob[] = new Array(totalChunks);
    let completed = 0;
    const sessionStart = Date.now();

    const report = (pct: number) => {
      const elapsed = (Date.now() - sessionStart) / 1000 || 1;
      const speed = completed > 0 ? (completed / totalChunks * (meta.size || 0)) / elapsed : 0;
      onProgress?.(Math.min(99, pct), speed, speed > 0 ? (1 - pct / 100) * (meta.size || 0) / speed : 0);
    };

    if (sequential) {
      for (let i = 0; i < totalChunks; i++) {
        if (signal?.aborted) throw new Error("Aborted");
        report(Math.round((i / totalChunks) * 100));
        const blob = initialBlobs[i] || await fetchAndDecryptChunk(worker, fileId, chunks[i], i, fileIv!, signal);
        blobs[i] = blob;
        completed++;
        onChunkDownloaded?.(i, blob);
      }
    } else {
      const tasks = chunks.map((chunk, i) => async () => {
        if (initialBlobs[i]) return initialBlobs[i];
        const blob = await fetchAndDecryptChunk(worker, fileId, chunk, i, fileIv!, signal);
        blobs[i] = blob;
        completed++;
        report(Math.round((completed / totalChunks) * 100));
        onChunkDownloaded?.(i, blob);
        return blob;
      });
      await runWithConcurrency(tasks, CONCURRENCY, signal);
    }

    const finalBlob = new Blob(blobs, { type: meta.type || "application/octet-stream" });
    return window.URL.createObjectURL(finalBlob);
  } finally {
    worker.terminate();
  }
}

interface UploadOptions {
  file: File;
  shouldEncrypt: boolean;
  isLast: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: number, speed: number, eta: number, uploadedChunks?: number, totalChunks?: number, uploadedBytes?: number) => void;
}

export async function processUpload({ file, shouldEncrypt, isLast, signal, onProgress }: UploadOptions): Promise<void> {
  const CHUNK_SIZE = 8192 * 1024;
  let fileId = "";
  let worker: Worker | null = null;

  try {
    const MASTER_KEY = import.meta.env.VITE_MASTER_KEY;
    if (shouldEncrypt && !MASTER_KEY) throw new Error("Missing Master Key");

    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${file.name}-${file.size}-${file.lastModified}`),
    );
    fileId = Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);

    let iv = "";
    let salt = "";

    if (shouldEncrypt) {
      worker = createEncryptionWorker();
      const gen = (n: number) =>
        Array.from(crypto.getRandomValues(new Uint8Array(n)))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      iv = gen(16);
      salt = gen(32);
      await initWorker(worker, MASTER_KEY!, salt);
    }

    await api.post("/upload/file/init", {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      iv: shouldEncrypt ? iv : null,
      salt: shouldEncrypt ? salt : null,
    });

    let existingChunks: number[] = [];
    try {
      const res = await api.get<number[]>(`/upload/file/${fileId}/chunks`);
      if (res) existingChunks = res;
    } catch {}

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunkProgress = new Float64Array(totalChunks);
    let finishedChunks = existingChunks.length;
    for (const idx of existingChunks) chunkProgress[idx] = CHUNK_SIZE;

    const sessionStart = Date.now();
    let lastUpdate = 0;

    const tasks = Array.from({ length: totalChunks }, (_, index) => async () => {
      if (existingChunks.includes(index)) return;
      if (signal?.aborted) throw new Error("Aborted");

      const start = index * CHUNK_SIZE;
      const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
      let payload = await blob.arrayBuffer();

      if (shouldEncrypt && worker) {
        payload = await encryptChunk(worker, payload, index, iv);
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${import.meta.env.VITE_API_URL}/upload/file/${fileId}/chunk`);
        xhr.setRequestHeader("Authorization", import.meta.env.VITE_API_SECRET || "");
        xhr.setRequestHeader("X-Chunk-Number", (index + 1).toString());

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            chunkProgress[index] = e.loaded;
            const now = Date.now();
            if (now - lastUpdate > 200) {
              const sent = chunkProgress.reduce((sum, val) => sum + val, 0);
              const prog = Math.min(99, Math.round((sent / file.size) * 30 + (finishedChunks / totalChunks) * 70));
              const elapsed = (now - sessionStart) / 1000;
              const speed = elapsed > 0 ? sent / elapsed : 0;
              onProgress(prog, speed, speed > 0 ? (file.size - sent) / speed : 0, finishedChunks, totalChunks, sent);
              lastUpdate = now;
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            chunkProgress[index] = payload.byteLength;
            finishedChunks++;
            resolve();
          } else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.onabort = () => reject(new Error("Aborted"));

        if (signal) signal.addEventListener("abort", () => xhr.abort(), { once: true });
        xhr.send(payload);
      });
    });

    await runWithConcurrency(tasks, CONCURRENCY, signal);
    await api.post(`/upload/file/${fileId}/finalize?skip_backup=${!isLast}`, {});
  } catch (err) {
    if (signal?.aborted) throw new Error("Aborted");
    throw err;
  } finally {
    worker?.terminate();
  }
}