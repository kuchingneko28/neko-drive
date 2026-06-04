import { Hono } from "hono";
import db from "../db";
import { backupDatabase } from "../lib/backup";
import { bulkDeleteFromDiscord } from "../lib/discord";
import { logger } from "../lib/logger";
import { apiResponse } from "../lib/response";
import type { ChunkMetadata, FileMetadata, PaginatedResponse } from "../types";

const files = new Hono();

const MAX_PAGE_LIMIT = 100;

files.get("/", async (ctx) => {
  try {
    const limit = Math.min(parseInt(ctx.req.query("limit") || "50") || 50, MAX_PAGE_LIMIT);
    const offset = Math.max(parseInt(ctx.req.query("offset") || "0") || 0, 0);
    const status = ctx.req.query("status") || "active";
    const sort = ctx.req.query("sort") || "created_at";
    const order = ctx.req.query("order")?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const allowedSort = ["name", "size", "created_at"];
    const sortCol = allowedSort.includes(sort) ? sort : "created_at";

    logger.debug(`Listing files (status: ${status}, sort: ${sortCol} ${order}, limit: ${limit}, offset: ${offset})`);

    const allFiles = db
      .prepare(
        `SELECT f.id, f.name, f.size, f.type, f.iv, f.salt, f.status, (f.created_at * 1000) as createdAt,
         (SELECT COUNT(*) FROM chunks WHERE file_id = f.id) as chunks
         FROM files f
         WHERE f.status = ?
         ORDER BY f.${sortCol} ${order}
         LIMIT ? OFFSET ?`,
      )
      .all(status, limit, offset) as FileMetadata[];
    const total = (db.prepare("SELECT COUNT(*) as count FROM files WHERE status = ?").get(status) as { count: number })
      .count;

    return apiResponse.success<PaginatedResponse<FileMetadata>>(ctx, {
      items: allFiles,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error("Failed to list files:", error);
    return apiResponse.error(ctx, "Failed to list files", 500);
  }
});

files.get("/search", async (ctx) => {
  const query = ctx.req.query("q");
  const status = ctx.req.query("status") || "active";

  if (!query) {
    return ctx.redirect(`/api/files?status=${status}`);
  }

  if (query.length > 200) {
    return apiResponse.error(ctx, "Search query too long", 400);
  }

  try {
    logger.debug(`Searching files for: "${query}" (status: ${status})`);
    const sanitized = query.replace(/"/g, '""');
    const results = db
      .prepare(
        `SELECT f.id, f.name, f.size, f.type, f.iv, f.salt, f.status, (f.created_at * 1000) as createdAt,
       (SELECT COUNT(*) FROM chunks WHERE file_id = f.id) as chunks
       FROM files f
       JOIN files_fts fts ON f.id = fts.id
       WHERE files_fts MATCH ? AND f.status = ?
       ORDER BY rank`,
      )
      .all(`${sanitized}*`, status) as FileMetadata[];

    return apiResponse.success<FileMetadata[]>(ctx, results);
  } catch (error: unknown) {
    logger.error(`Search error for "${query}":`, error);
    return apiResponse.error(ctx, "Search failed", 500);
  }
});

files.get("/:id", async (ctx) => {
  const id = ctx.req.param("id");
  try {
    logger.debug(`Fetching file details for ${id}`);
    const file = db
      .prepare(
        "SELECT id, name, size, type, iv, salt, status, (created_at * 1000) as createdAt FROM files WHERE id = ?",
      )
      .get(id) as FileMetadata | undefined;
    if (!file) {
      logger.warn(`File not found: ${id}`);
      return apiResponse.error(ctx, "File not found", 404);
    }

    const chunks = db.prepare("SELECT * FROM chunks WHERE file_id = ? ORDER BY idx ASC").all(id) as ChunkMetadata[];

    return apiResponse.success<FileMetadata & { chunks: ChunkMetadata[] }>(ctx, {
      ...file,
      chunks,
    });
  } catch (error: unknown) {
    logger.error(`Failed to fetch file details for ${id}:`, error);
    return apiResponse.error(ctx, "Failed to fetch file details", 500);
  }
});

files.post("/:id/restore", async (ctx) => {
  const id = ctx.req.param("id");
  try {
    const file = db.prepare("SELECT status FROM files WHERE id = ?").get(id) as { status: string } | undefined;
    if (!file) return apiResponse.error(ctx, "File not found", 404);

    if (file.status !== "trashed") {
      return apiResponse.error(ctx, "File is not in trash", 400);
    }

    db.run("UPDATE files SET status = 'active' WHERE id = ?", [id]);
    logger.info(`Restored file ${id} from trash`);

    backupDatabase().catch((err: unknown) => {
      logger.error("Background backup failed after restoration:", err);
    });

    return apiResponse.success(ctx, { message: "File restored" });
  } catch (error: unknown) {
    logger.error(`Failed to restore file ${id}:`, error);
    return apiResponse.error(ctx, "Failed to restore file", 500);
  }
});

files.delete("/trash", async (ctx) => {
  try {
    const trashedFiles = db.prepare("SELECT id FROM files WHERE status = 'trashed'").all() as { id: string }[];

    if (trashedFiles.length === 0) {
      return apiResponse.success(ctx, { message: "Trash is already empty", deletedCount: 0 });
    }

    const ids = trashedFiles.map((file) => file.id);
    const placeholders = ids.map(() => "?").join(",");

    const chunks = db.prepare(`SELECT message_id FROM chunks WHERE file_id IN (${placeholders})`).all(...ids) as {
      message_id: string;
    }[];
    const messageIds = chunks.map((chunk) => chunk.message_id);

    const deleteStmt = db.transaction(() => {
      db.run(`DELETE FROM files WHERE id IN (${placeholders})`, ids);
      db.run(`DELETE FROM chunks WHERE file_id IN (${placeholders})`, ids);
    });
    deleteStmt();

    logger.info(`Emptied trash: Deleted ${ids.length} files and cleaning up ${messageIds.length} chunks`);

    bulkDeleteFromDiscord(messageIds).catch((err: unknown) => {
      logger.error("Background Discord cleanup failed for empty trash:", err);
    });

    backupDatabase().catch((err: unknown) => {
      logger.error("Background backup failed after empty trash:", err);
    });

    return apiResponse.success(ctx, { message: "Trash emptied", deletedCount: ids.length });
  } catch (error: unknown) {
    logger.error("Failed to empty trash:", error);
    return apiResponse.error(ctx, "Failed to empty trash", 500);
  }
});

files.patch("/:id", async (ctx) => {
  const id = ctx.req.param("id");
  const { name } = (await ctx.req.json()) as { name?: string };

  if (!name || typeof name !== "string" || name.length > 512) {
    return apiResponse.error(ctx, "Invalid or missing file name", 400);
  }

  try {
    const file = db.prepare("SELECT status FROM files WHERE id = ?").get(id) as { status: string } | undefined;
    if (!file) return apiResponse.error(ctx, "File not found", 404);
    if (file.status !== "active") return apiResponse.error(ctx, "Only active files can be renamed", 400);

    db.run("UPDATE files SET name = ? WHERE id = ?", [name, id]);
    return apiResponse.success(ctx, { message: "File renamed" });
  } catch (error: unknown) {
    logger.error(`Failed to rename file ${id}:`, error);
    return apiResponse.error(ctx, "Failed to rename file", 500);
  }
});

files.delete("/:id", async (ctx) => {
  const id = ctx.req.param("id");
  try {
    const file = db.prepare("SELECT status, name FROM files WHERE id = ?").get(id) as
      | { status: string; name: string }
      | undefined;
    if (!file) return apiResponse.error(ctx, "File not found", 404);

    if (file.status === "active") {
      db.run("UPDATE files SET status = 'trashed' WHERE id = ?", [id]);
      logger.info(`Soft deleted (trashed) file ${id}`);

      backupDatabase().catch((err: unknown) => {
        logger.error("Background backup failed after trashing:", err);
      });

      return apiResponse.success(ctx, { message: "File moved to trash" });
    }

    logger.info(`Permanently deleting file ${id}`);

    const chunks = db.prepare("SELECT message_id FROM chunks WHERE file_id = ?").all(id) as { message_id: string }[];
    const messageIds = chunks.map((chunk) => chunk.message_id);

    db.run("DELETE FROM files WHERE id = ?", [id]);

    logger.debug(`Deleted metadata for ${id}, cleaning up ${messageIds.length} chunks on Discord`);

    bulkDeleteFromDiscord(messageIds).catch((err: unknown) => {
      logger.error(`Background Discord cleanup failed for ${id}:`, err);
    });

    backupDatabase().catch((err: unknown) => {
      logger.error("Background backup failed after deletion:", err);
    });

    return apiResponse.success(ctx, { message: "File permanently deleted" });
  } catch (error: unknown) {
    logger.error(`Failed to delete file ${id}:`, error);
    return apiResponse.error(ctx, "Failed to delete file", 500);
  }
});

export default files;