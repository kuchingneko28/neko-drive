import { app } from "./app";
import { logger } from "./lib/logger";
import { PORT, IDLE_TIMEOUT, STALE_PENDING_MS } from "./config";
import { pruneExpired } from "./lib/media-token";
import { purgePendingFiles } from "./lib/pending";
import { backupDatabase } from "./lib/backup";
import db from "./db";

logger.info(`Librarian starting on port ${PORT}`);

// Periodic VACUUM (every 4 hours to keep DB healthy)
const VACUUM_INTERVAL = 4 * 60 * 60 * 1000;
let vacuumTimer: Timer | null = null;
let mediaTokenCleanupTimer: Timer | null = null;

function scheduleVacuum() {
  vacuumTimer = setTimeout(() => {
    try {
      logger.info("Running scheduled VACUUM");
      db.exec("VACUUM;");
      logger.info("Scheduled VACUUM complete");
    } catch (error) {
      logger.error("Scheduled VACUUM failed:", error);
    }
    scheduleVacuum();
  }, VACUUM_INTERVAL);
}
scheduleVacuum();

// Periodic sweep of expired media tokens + stale pending uploads (every 5 min)
function scheduleCleanup() {
  mediaTokenCleanupTimer = setTimeout(() => {
    pruneExpired();
    const cutoff = Math.floor((Date.now() - STALE_PENDING_MS) / 1000);
    purgePendingFiles(cutoff);
    scheduleCleanup();
  }, 5 * 60 * 1000);
}
scheduleCleanup();
// Also sweep once at boot so yesterday's interrupted uploads don't linger.
pruneExpired();
purgePendingFiles(Math.floor((Date.now() - STALE_PENDING_MS) / 1000));

// Daily auto-backup so the Discord copy protects even read-only days.
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
let backupTimer: Timer | null = null;
function scheduleBackup() {
  backupTimer = setTimeout(() => {
    backupDatabase();
    scheduleBackup();
  }, BACKUP_INTERVAL);
}
scheduleBackup();

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (vacuumTimer) clearTimeout(vacuumTimer);
  if (mediaTokenCleanupTimer) clearTimeout(mediaTokenCleanupTimer);
  if (backupTimer) clearTimeout(backupTimer);
  db.close();
  logger.info("Database closed. Goodbye.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default {
  port: PORT,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  idleTimeout: IDLE_TIMEOUT,
};
