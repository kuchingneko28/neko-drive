export const VERSION = "2.1.0";
export const PORT = parseInt(process.env.PORT || "3000", 10);
export const IDLE_TIMEOUT = parseInt(process.env.IDLE_TIMEOUT || "255", 10);
// Pending uploads older than this (interrupted transfers) are swept by the
// periodic cleanup — chunks + metadata get purged from the DB and Discord.
export const STALE_PENDING_MS = parseInt(process.env.STALE_PENDING_MS || `${24 * 60 * 60 * 1000}`, 10);