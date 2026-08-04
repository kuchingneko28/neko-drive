import db from "../db";
import { logger } from "./logger";
import { bulkDeleteFromDiscord } from "./discord";

/**
 * Delete pending (never-finalized) uploads and their Discord shards.
 *
 * Used by the manual "purge all pending" endpoint (no cutoff) and by the
 * periodic sweep (cutoff) so an interrupted upload — browser crash, closed
 * laptop — doesn't orphan rows + Discord shards forever.
 *
 * `cutoffSeconds` is a unix timestamp in seconds (matches `files.created_at`);
 * default keeps the current "purge everything" behavior. Never throws.
 */
export function purgePendingFiles(
  cutoffSeconds = Number.MAX_SAFE_INTEGER,
): number {
  try {
    const where =
      "file_id IN (SELECT id FROM files WHERE status = 'pending' AND created_at < ?)";
    const chunks = db
      .prepare(`SELECT message_id FROM chunks WHERE ${where}`)
      .all(cutoffSeconds) as { message_id: string }[];

    const messageIds = chunks.map((chunk) => chunk.message_id);

    db.run(`DELETE FROM chunks WHERE ${where}`, [cutoffSeconds]);
    db.run(`DELETE FROM files WHERE status = 'pending' AND created_at < ?`, [
      cutoffSeconds,
    ]);

    if (messageIds.length > 0) {
      bulkDeleteFromDiscord(messageIds).catch((error: unknown) => {
        logger.error("Background pending-purge Discord cleanup failed:", error);
      });
    }

    if (messageIds.length > 0) {
      logger.info(
        `Purged ${messageIds.length} shards from stale pending uploads`,
      );
    }
    return messageIds.length;
  } catch (error: unknown) {
    logger.error("Failed to purge pending uploads:", error);
    return 0;
  }
}
