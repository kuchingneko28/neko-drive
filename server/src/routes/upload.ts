import { Hono } from "hono";
import db from "../db";
import { MAX_FILE_SIZE } from "../config";
import { backupDatabase } from "../lib/backup";
import { bulkDeleteFromDiscord, uploadToDiscord } from "../lib/discord";
import { logger } from "../lib/logger";
import { apiResponse } from "../lib/response";

interface FileInitRequest {
  id: string;
  name: string;
  size: number;
  type?: string;
  iv?: string | null;
  salt?: string | null;
}

interface ChunkUploadResponse {
  messageId: string;
}

const upload = new Hono();

const HEX_REGEX = /^[0-9a-fA-F]+$/;

function isValidHex(str: string, minLen = 1): boolean {
  return str.length >= minLen && HEX_REGEX.test(str);
}

upload.post("/file/init", async (ctx) => {
  const body = (await ctx.req.json()) as FileInitRequest;

  const { id, name, size, type, iv, salt } = body;

  if (!id || typeof id !== "string" || id.length > 64) {
    return apiResponse.error(ctx, "Invalid or missing file id", 400);
  }
  if (!name || typeof name !== "string" || name.length > 512) {
    return apiResponse.error(ctx, "Invalid or missing file name", 400);
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_FILE_SIZE) {
    return apiResponse.error(ctx, `Invalid file size (max ${MAX_FILE_SIZE} bytes)`, 400);
  }

  if (iv && typeof iv === "string" && iv.length > 0 && !isValidHex(iv, 24)) {
    return apiResponse.error(ctx, "Invalid IV format", 400);
  }
  if (salt && typeof salt === "string" && salt.length > 0 && !isValidHex(salt, 24)) {
    return apiResponse.error(ctx, "Invalid salt format", 400);
  }

  try {
    const existing = db.prepare("SELECT status FROM files WHERE id = ?").get(id) as
      | { status: string }
      | undefined;

    if (existing) {
      if (existing.status === "active") {
        return apiResponse.error(ctx, "File ID already exists and is active", 409);
      }
      logger.debug(`Replacing pending file record: ${id}`);
      db.run("DELETE FROM files WHERE id = ?", [id]);
    }

    logger.debug(`Initializing file record: ${name} (${id})`);
    db.run(
      "INSERT INTO files (id, name, size, type, iv, salt, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name, size, type || "application/octet-stream", iv || null, salt || null, "pending"],
    );
    return apiResponse.success(ctx);
  } catch (error: unknown) {
    logger.error("Init Error:", error);
    return apiResponse.error(ctx, "Failed to initialize file record", 500);
  }
});

upload.post("/file/:id/chunk", async (ctx) => {
  const fileId = ctx.req.param("id");

  let chunkIndex = 0;
  const chunkHeader = ctx.req.header("X-Chunk-Number");
  const contentRange = ctx.req.header("Content-Range");

  if (chunkHeader) {
    chunkIndex = parseInt(chunkHeader, 10);
    if (isNaN(chunkIndex) || chunkIndex < 1) {
      return apiResponse.error(ctx, "Invalid X-Chunk-Number header", 400);
    }
    chunkIndex -= 1;
  } else if (contentRange) {
    const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match) {
      return apiResponse.error(ctx, "Invalid Content-Range header", 400);
    }
    const start = parseInt(match[1], 10);
    if (start > 0) {
      const chunk0 = db.prepare("SELECT size FROM chunks WHERE file_id = ? AND idx = 0").get(fileId) as
        | { size: number }
        | undefined;
      if (chunk0) {
        chunkIndex = Math.round(start / chunk0.size);
      } else {
        return apiResponse.error(ctx, "Missing initial chunk; cannot compute index", 400);
      }
    }
  }

  const buffer = await ctx.req.arrayBuffer();

  if (!buffer || buffer.byteLength === 0) {
    return apiResponse.error(ctx, "Empty chunk", 400);
  }

  const fileExists = db.prepare("SELECT 1 FROM files WHERE id = ? AND status = 'pending'").get(fileId);
  if (!fileExists) {
    return apiResponse.error(ctx, "Upload session invalid or aborted", 404);
  }

  try {
    const existingChunk = db
      .prepare("SELECT message_id FROM chunks WHERE file_id = ? AND idx = ?")
      .get(fileId, chunkIndex) as { message_id: string } | undefined;

    if (existingChunk) {
      logger.warn(`Overwriting existing chunk ${chunkIndex} for file ${fileId}`);
      db.run("DELETE FROM chunks WHERE file_id = ? AND idx = ?", [fileId, chunkIndex]);
      bulkDeleteFromDiscord([existingChunk.message_id]).catch((error) =>
        logger.error("Failed to clean up overwritten chunk:", error),
      );
    }

    const filename = `chunk_${fileId}_${chunkIndex}.bin`;
    const attachment = await uploadToDiscord(buffer, filename, ctx.req.raw.signal);

    logger.debug(`Chunk ${chunkIndex} uploaded to Discord: ${attachment.id}`);

    const fileStillExists = db.prepare("SELECT 1 FROM files WHERE id = ? AND status = 'pending'").get(fileId);

    if (!fileStillExists) {
      logger.warn(`File ${fileId} aborted during chunk ${chunkIndex} upload. Cleaning up orphaned chunk.`);
      bulkDeleteFromDiscord([attachment.id]).catch((error) => logger.error("Failed to clean up orphaned chunk:", error));
      return apiResponse.error(ctx, "Upload aborted during transfer", 404);
    }

    db.run(
      "INSERT INTO chunks (file_id, idx, message_id, channel_id, size, url) VALUES (?, ?, ?, ?, ?, ?)",
      [fileId, chunkIndex, attachment.id, process.env.DISCORD_CHANNEL_ID || "", buffer.byteLength, attachment.url],
    );

    return apiResponse.success(ctx, {
      messageId: attachment.id,
    });
  } catch (error: unknown) {
    logger.error(`Chunk ${chunkIndex} Error:`, error);
    return apiResponse.error(ctx, "Failed to upload chunk to storage", 500);
  }
});

upload.get("/file/:id/chunks", async (ctx) => {
  const fileId = ctx.req.param("id");
  try {
    const chunks = db.prepare("SELECT idx FROM chunks WHERE file_id = ?").all(fileId) as {
      idx: number;
    }[];
    return apiResponse.success(ctx,
      chunks.map((ch) => ch.idx),
    );
  } catch (error: unknown) {
    logger.error("Chunk Discovery Error:", error);
    return apiResponse.error(ctx, "Failed to fetch chunk metadata", 500);
  }
});

upload.post("/file/:id/finalize", async (ctx) => {
  const fileId = ctx.req.param("id");

  try {
    logger.info(`Finalizing file ${fileId}`);
    db.run("UPDATE files SET status = 'active' WHERE id = ?", [fileId]);

    const skipBackup = ctx.req.query("skip_backup") === "true";

    if (!skipBackup) {
      backupDatabase().catch((error: unknown) => {
        logger.error("Background task failed:", error);
      });
    }

    return apiResponse.success(ctx);
  } catch (error: unknown) {
    logger.error("Finalize Error:", error);
    return apiResponse.error(ctx, "Failed to finalize file", 500);
  }
});

upload.post("/file/:id/abort", async (ctx) => {
  const fileId = ctx.req.param("id");

  try {
    logger.info(`Aborting archival for file ${fileId}`);
    const chunks = db.prepare("SELECT message_id FROM chunks WHERE file_id = ?").all(fileId) as {
      message_id: string;
    }[];
    const messageIds = chunks.map((chunk) => chunk.message_id);

    db.run("DELETE FROM files WHERE id = ? AND status = 'pending'", [fileId]);
    logger.debug(`Purged pending metadata for ${fileId}, cleaning up ${messageIds.length} shards`);

    if (messageIds.length > 0) {
      bulkDeleteFromDiscord(messageIds).catch((error: unknown) => {
        logger.error(`Background abort cleanup failed for ${fileId}:`, error);
      });
    }

    return apiResponse.success(ctx);
  } catch (error: unknown) {
    logger.error(`Failed to abort archival for ${fileId}:`, error);
    return apiResponse.error(ctx, "Failed to abort archival", 500);
  }
});

upload.delete("/file/pending/all", async (ctx) => {
  try {
    logger.info("Bulk purging all pending uploads");
    const chunks = db
      .prepare(
        `SELECT message_id FROM chunks
       WHERE file_id IN (SELECT id FROM files WHERE status = 'pending')`,
      )
      .all() as { message_id: string }[];

    const messageIds = chunks.map((chunk) => chunk.message_id);

    db.run("DELETE FROM chunks WHERE file_id IN (SELECT id FROM files WHERE status = 'pending')");
    db.run("DELETE FROM files WHERE status = 'pending'");

    logger.debug(`Purged all pending metadata, cleaning up ${messageIds.length} shards`);

    if (messageIds.length > 0) {
      bulkDeleteFromDiscord(messageIds).catch((error: unknown) => {
        logger.error("Background bulk-purge cleanup failed:", error);
      });
    }

    return apiResponse.success(ctx, { purgedCount: messageIds.length });
  } catch (error: unknown) {
    logger.error("Bulk Purge Error:", error);
    return apiResponse.error(ctx, "Failed to purge pending uploads", 500);
  }
});

export default upload;