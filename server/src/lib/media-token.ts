import { randomBytes } from "node:crypto";
import { logger } from "./logger";

/**
 * Short-lived, per-file tokens for media URLs (/stream, /download).
 *
 * The browser cannot set an Authorization header on <video>/<img>/<a>
 * requests, so those URLs used to carry the master API secret as ?token=,
 * leaking it into history and server logs. Instead the client exchanges its
 * secret (via header) for a random token bound to one file, valid for one
 * hour — long enough for a media session with seeking, short enough that a
 * leaked URL is useless quickly.
 */

const MEDIA_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const store = new Map<string, { fileId: string; expiresAt: number }>();

export function issueMediaToken(fileId: string): {
  token: string;
  expiresAt: number;
} {
  pruneExpired();
  const token = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + MEDIA_TOKEN_TTL_MS;
  store.set(token, { fileId, expiresAt });
  return { token, expiresAt };
}

export function verifyMediaToken(token: string): { fileId: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return { fileId: entry.fileId };
}

export function pruneExpired(): number {
  const now = Date.now();
  let removed = 0;
  store.forEach((entry, token) => {
    if (now >= entry.expiresAt) {
      store.delete(token);
      removed++;
    }
  });
  if (removed > 0) logger.debug(`Pruned ${removed} expired media tokens`);
  return removed;
}
