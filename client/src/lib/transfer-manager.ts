import type { ChunkMetadata, FileMetadata } from "@/types";
import { api } from "./api";
import { isFileEncrypted } from "./file-utils";
import { bytesToHex } from "./iv";
import {
  createEncryptionWorker,
  createWorkerPool,
  encryptChunkPool,
  initWorker,
  initWorkerPool,
  decryptChunk,
} from "./worker";

const CONCURRENCY = 3;

// Aborts are signalled with DOMException("Aborted", "AbortError") — the same
// error type the platform uses — so hooks can distinguish a deliberate cancel
// from a real failure via `error instanceof DOMException && error.name === "AbortError"`.
const abortError = () => new DOMException("Aborted", "AbortError");

function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  signal?: AbortSignal,
): Promise<T[]> {
  if (signal?.aborted) throw abortError();

  return new Promise((resolve, reject) => {
    const results: T[] = new Array(tasks.length);
    let currentIndex = 0;
    let running = 0;
    let aborted = false;

    const onAbort = () => {
      aborted = true;
      reject(abortError());
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
      } catch (error) {
        if (!aborted) {
          aborted = true;
          signal?.removeEventListener("abort", onAbort);
          reject(error);
          return;
        }
      }
    };

    for (let i = 0; i < Math.min(concurrency, tasks.length); i++) runNext();
  });
}

interface DownloadOptions {
  fileId: string;
  signal?: AbortSignal;
  initialBlobs?: Blob[];
  onChunkDownloaded?: (index: number, chunk: Blob) => void;
  onProgress?: (progress: number, speed: number, eta: number) => void;
}

/**
 * Reads exactly `length` bytes from a stream, carrying surplus bytes across
 * reads. One read() may deliver more or fewer bytes than the frame needs
 * (and may even coalesce several frames), so alignment is handled here.
 */
export async function readFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  length: number,
  leftover: Uint8Array | null,
  onBytes?: (count: number) => void,
): Promise<{ frame: Uint8Array; leftover: Uint8Array | null }> {
  const buf = new Uint8Array(length);
  let offset = 0;
  if (leftover) {
    const take = Math.min(leftover.length, length);
    buf.set(leftover.subarray(0, take), 0);
    offset = take;
    leftover = take < leftover.length ? leftover.subarray(take) : null;
  }
  while (offset < length) {
    const { done, value } = await reader.read();
    if (done || !value) throw new Error("Stream ended early");
    const take = Math.min(value.length, length - offset);
    buf.set(value.subarray(0, take), offset);
    offset += take;
    onBytes?.(take);
    if (take < value.length) leftover = value.subarray(take);
  }
  return { frame: buf, leftover };
}

export async function processDownload({
  fileId,
  signal,
  initialBlobs = [],
  onChunkDownloaded,
  onProgress,
}: DownloadOptions): Promise<string> {
  const meta = await api.get<FileMetadata & { chunks: ChunkMetadata[] }>(
    `/files/${fileId}`,
  );
  if (!meta) throw new Error("File metadata not found");

  const { chunks, salt, iv: fileIv } = meta;
  const encrypted = isFileEncrypted({ iv: fileIv, salt });

  if (!encrypted) {
    // Media elements can't send an Authorization header, so exchange the
    // master secret for a short-lived, file-scoped media token instead of
    // putting the secret itself in the URL.
    const media = await api.get<{ token: string; expiresAt: number }>(
      `/media-token?file=${fileId}`,
    );
    return `${import.meta.env.VITE_API_URL}/stream/file/${fileId}?token=${media.token}`;
  }

  const MASTER_KEY = import.meta.env.VITE_MASTER_KEY;
  if (!MASTER_KEY) throw new Error("Missing Master Key");

  const worker = createEncryptionWorker();
  await initWorker(worker, MASTER_KEY, salt!);

  try {
    const totalChunks = chunks.length;
    const blobs: Blob[] = new Array(totalChunks);
    for (let i = 0; i < totalChunks; i++) {
      if (initialBlobs[i]) blobs[i] = initialBlobs[i];
    }

    // Stream from the first chunk we don't already have cached
    let resumeIndex = 0;
    while (resumeIndex < totalChunks && initialBlobs[resumeIndex])
      resumeIndex++;

    const sessionStart = Date.now();

    const base = `${import.meta.env.VITE_API_URL}/download/${fileId}`;
    const headers = { Authorization: import.meta.env.VITE_API_SECRET || "" };

    // Single streaming request — the server prefetches chunks ahead, so
    // network latency is hidden instead of serialized as N round-trips.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${base}?start_chunk=${resumeIndex}`, {
          signal,
          headers,
        });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        let leftover: Uint8Array | null = null;
        // Bytes we already have (cached prefix) — progress must continue from
        // there, not restart at 0.
        let bytesRead = 0;
        for (let k = 0; k < resumeIndex; k++) bytesRead += chunks[k].size;
        const encryptedTotal = meta.chunks.reduce(
          (sum, chunk) => sum + chunk.size,
          0,
        );
        let lastReport = 0;

        for (let i = resumeIndex; i < totalChunks; i++) {
          resumeIndex = i;
          if (signal?.aborted) throw abortError();

          const result = await readFrame(
            reader,
            chunks[i].size,
            leftover,
            (count) => {
              bytesRead += count;
              // Progress by bytes read, throttled — on slow links the first
              // chunk can take tens of seconds, so don't sit at 0% waiting.
              const now = Date.now();
              if (now - lastReport > 250) {
                lastReport = now;
                const pct = Math.min(
                  99,
                  Math.round((bytesRead / encryptedTotal) * 100),
                );
                const elapsed = (now - sessionStart) / 1000 || 1;
                const speed = bytesRead / elapsed;
                onProgress?.(
                  pct,
                  speed,
                  speed > 0 ? (encryptedTotal - bytesRead) / speed : 0,
                );
              }
            },
          );
          leftover = result.leftover;
          const buf = result.frame;

          if (initialBlobs[i]) continue; // cached (non-contiguous resume)

          const decrypted = await decryptChunk(
            worker,
            buf.buffer as ArrayBuffer,
            i,
            fileIv!,
          );
          const blob = new Blob([decrypted]);
          blobs[i] = blob;
          onChunkDownloaded?.(i, blob);
        }

        await reader.cancel().catch(() => {});
        break; // all chunks done
      } catch (error) {
        if (signal?.aborted) throw abortError();
        if (attempt >= 2) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
      }
    }

    const finalBlob = new Blob(blobs, {
      type: meta.type || "application/octet-stream",
    });
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
  onProgress?: (
    progress: number,
    speed: number,
    eta: number,
    uploadedChunks?: number,
    totalChunks?: number,
    uploadedBytes?: number,
  ) => void;
}

export async function processUpload({
  file,
  shouldEncrypt,
  isLast,
  signal,
  onProgress,
}: UploadOptions): Promise<void> {
  const CHUNK_SIZE = 8192 * 1024;
  let fileId = "";
  let pool: Worker[] | null = null;

  try {
    const MASTER_KEY = import.meta.env.VITE_MASTER_KEY;
    if (shouldEncrypt && !MASTER_KEY) throw new Error("Missing Master Key");

    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `${file.name}-${file.size}-${file.lastModified}`,
      ),
    );
    fileId = bytesToHex(new Uint8Array(hash)).slice(0, 32);

    let iv = "";
    let salt = "";

    if (shouldEncrypt) {
      pool = createWorkerPool(CONCURRENCY);
      const gen = (n: number) =>
        bytesToHex(crypto.getRandomValues(new Uint8Array(n)));
      iv = gen(16);
      salt = gen(32);
      await initWorkerPool(pool, MASTER_KEY!, salt);
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

    const tasks = Array.from(
      { length: totalChunks },
      (_, index) => async () => {
        if (existingChunks.includes(index)) return;
        if (signal?.aborted) throw abortError();

        const start = index * CHUNK_SIZE;
        const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        let payload = await blob.arrayBuffer();

        if (shouldEncrypt && pool) {
          payload = await encryptChunkPool(pool, payload, index, iv);
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `${import.meta.env.VITE_API_URL}/upload/file/${fileId}/chunk`,
          );
          xhr.setRequestHeader(
            "Authorization",
            import.meta.env.VITE_API_SECRET || "",
          );
          xhr.setRequestHeader("X-Chunk-Number", (index + 1).toString());

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
              chunkProgress[index] = e.loaded;
              const now = Date.now();
              // ponytail: 1 Hz is plenty for a progress bar; 5 Hz caused
              // whole-tree re-renders + BroadcastChannel churn during big uploads.
              if (now - lastUpdate > 1000) {
                const sent = chunkProgress.reduce(
                  (sum, value) => sum + value,
                  0,
                );
                const prog = Math.min(
                  99,
                  Math.round(
                    (sent / file.size) * 30 +
                      (finishedChunks / totalChunks) * 70,
                  ),
                );
                const elapsed = (now - sessionStart) / 1000;
                const speed = elapsed > 0 ? sent / elapsed : 0;
                onProgress(
                  prog,
                  speed,
                  speed > 0 ? (file.size - sent) / speed : 0,
                  finishedChunks,
                  totalChunks,
                  sent,
                );
                lastUpdate = now;
              }
            }
          };

          xhr.onload = () => {
            signal?.removeEventListener("abort", onAbort);
            if (xhr.status >= 200 && xhr.status < 300) {
              chunkProgress[index] = payload.byteLength;
              finishedChunks++;
              resolve();
            } else reject(new Error(`Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => {
            signal?.removeEventListener("abort", onAbort);
            reject(new Error("Network Error"));
          };
          xhr.onabort = () => {
            signal?.removeEventListener("abort", onAbort);
            reject(abortError());
          };

          const onAbort = () => xhr.abort();
          if (signal) signal.addEventListener("abort", onAbort, { once: true });
          xhr.send(payload);
        });
      },
    );

    await runWithConcurrency(tasks, CONCURRENCY, signal);
    await api.post(
      `/upload/file/${fileId}/finalize?skip_backup=${!isLast}`,
      {},
    );
  } catch (error) {
    if (signal?.aborted) {
      // tell the server to drop the pending file + its Discord chunks,
      // otherwise they're orphaned until the manual purge
      if (fileId) api.post(`/upload/file/${fileId}/abort`, {}).catch(() => {});
      throw abortError();
    }
    throw error;
  } finally {
    pool?.forEach((worker) => worker.terminate());
  }
}
