import { describe, expect, test } from "bun:test";
import { createEncryptionWorker, decryptChunk, encryptChunk, initWorker } from "../lib/worker";

const PASSWORD = "test-master-key";
const SALT = "ab".repeat(32); // 64 hex chars = 32 bytes
const FILE_IV = "cf".repeat(16); // 32 hex chars = 16 bytes

function plaintextChunk(index: number, size = 64 * 1024): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (index * 31 + i) % 256;
  return bytes;
}

describe("worker crypto round-trip (chunkIv)", () => {
  test("encrypt then decrypt with the same chunk index recovers the plaintext", async () => {
    const worker = createEncryptionWorker();
    await initWorker(worker, PASSWORD, SALT);

    for (const index of [0, 1, 2, 257]) {
      const plaintext = plaintextChunk(index);
      const encrypted = await encryptChunk(worker, plaintext.slice().buffer as ArrayBuffer, index, FILE_IV);
      const decrypted = await decryptChunk(worker, encrypted, index, FILE_IV);
      expect(new Uint8Array(decrypted) as Uint8Array<ArrayBuffer>).toEqual(plaintext);
    }
    worker.terminate();
  });

  test("decrypting with the wrong chunk index fails (per-chunk IV is enforced)", async () => {
    const worker = createEncryptionWorker();
    await initWorker(worker, PASSWORD, SALT);

    const plaintext = plaintextChunk(1);
    const encrypted = await encryptChunk(worker, plaintext.slice().buffer as ArrayBuffer, 1, FILE_IV);

    let rejected = false;
    try {
      await decryptChunk(worker, encrypted, 0, FILE_IV);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
    worker.terminate();
  });
});
