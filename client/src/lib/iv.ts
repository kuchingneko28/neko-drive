/**
 * Per-chunk IV derivation for AES-GCM.
 *
 * A file uses one random 16-byte IV, but every chunk must be encrypted with a
 * unique IV under the same derived key — reusing a (key, IV) pair across
 * chunks breaks GCM confidentiality. Standard construction: 12 random bytes
 * followed by a 4-byte big-endian counter.
 */

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function chunkIv(
  fileIvHex: string,
  index: number,
): Uint8Array<ArrayBuffer> {
  const iv = hexToBytes(fileIvHex);
  iv[12] = (index >>> 24) & 0xff;
  iv[13] = (index >>> 16) & 0xff;
  iv[14] = (index >>> 8) & 0xff;
  iv[15] = index & 0xff;
  return iv;
}
