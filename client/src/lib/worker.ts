type MessageHandler = (e: MessageEvent) => void;

export function createEncryptionWorker(): Worker {
  return new Worker(
    new URL("../workers/processor.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
}

function waitForMessage<T>(
  worker: Worker,
  matchType: string,
  predicate?: (payload: unknown) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler: MessageHandler = (e) => {
      if (
        e.data.type === matchType &&
        (!predicate || predicate(e.data.payload))
      ) {
        worker.removeEventListener("message", handler);
        resolve(e.data.payload);
      } else if (e.data.type === "ERROR") {
        worker.removeEventListener("message", handler);
        reject(new Error(e.data.payload));
      }
    };
    worker.addEventListener("message", handler);
  });
}

export function initWorker(
  worker: Worker,
  password: string,
  salt: string,
): Promise<void> {
  const ready = waitForMessage<void>(worker, "INIT_READY");
  worker.postMessage({ type: "INIT", payload: { password, salt } });
  return ready.then(() => undefined);
}

export function encryptChunk(
  worker: Worker,
  chunk: ArrayBuffer,
  index: number,
  iv: string,
): Promise<ArrayBuffer> {
  worker.postMessage({ type: "ENCRYPT_CHUNK", payload: { chunk, index, iv } }, [
    chunk,
  ]);
  return waitForMessage<{ chunk: ArrayBuffer }>(
    worker,
    "CHUNK_ENCRYPTED",
    (p) => (p as { index: number }).index === index,
  ).then((p) => p.chunk);
}

export function decryptChunk(
  worker: Worker,
  chunk: ArrayBuffer,
  index: number,
  iv: string,
): Promise<ArrayBuffer> {
  worker.postMessage({ type: "DECRYPT_CHUNK", payload: { chunk, index, iv } }, [
    chunk,
  ]);
  return waitForMessage<{ chunk: ArrayBuffer }>(
    worker,
    "CHUNK_DECRYPTED",
    (p) => (p as { index: number }).index === index,
  ).then((p) => p.chunk);
}

/**
 * A small worker pool for parallel encryption.
 * Uploads run CONCURRENCY chunks at once, but a single worker serializes
 * every encrypt call — the extra workers keep encryption from being the
 * bottleneck on fast connections.
 */
export function createWorkerPool(size: number): Worker[] {
  return Array.from({ length: size }, () => createEncryptionWorker());
}

export async function initWorkerPool(
  pool: Worker[],
  password: string,
  salt: string,
): Promise<void> {
  await Promise.all(pool.map((worker) => initWorker(worker, password, salt)));
}

let poolCursor = 0;

export function encryptChunkPool(
  pool: Worker[],
  chunk: ArrayBuffer,
  index: number,
  iv: string,
): Promise<ArrayBuffer> {
  const worker = pool[poolCursor++ % pool.length];
  return encryptChunk(worker, chunk, index, iv);
}
