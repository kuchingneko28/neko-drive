import { Hono } from "hono";
import db from "../db";
import { logger } from "../lib/logger";
import { resolveChunkUrlWithFallback } from "../lib/refresh-url";
import { apiResponse } from "../lib/response";
import type { ChunkMetadata, FileMetadata } from "../types";

const stream = new Hono();

stream.get("/file/:id", async (ctx) => {
  const fileId = ctx.req.param("id");
  const rangeHeader = ctx.req.header("Range");

  try {
    const file = db.prepare("SELECT size, name, type FROM files WHERE id = ?").get(fileId) as FileMetadata | undefined;
    if (!file) return apiResponse.error(ctx, "File not found", 404);

    let start = 0;
    let end = file.size - 1;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      if (parts[1]) end = parseInt(parts[1], 10);
    }

    const chunks = db
      .prepare("SELECT idx, size, url, message_id, channel_id FROM chunks WHERE file_id = ? ORDER BY idx ASC")
      .all(fileId) as ChunkMetadata[];

    let currentOffset = 0;
    let targetChunk: ChunkMetadata | null = null;
    let chunkStartOffset = 0;

    for (const chunk of chunks) {
      if (start >= currentOffset && start < currentOffset + chunk.size) {
        targetChunk = chunk;
        chunkStartOffset = currentOffset;
        break;
      }
      currentOffset += chunk.size;
    }

    if (!targetChunk) return apiResponse.error(ctx, "Range Not Satisfiable", 416);

    const localStart = start - chunkStartOffset;
    const requestSize = end - start + 1;
    const actualLength = Math.min(requestSize, targetChunk.size - localStart);
    const localEnd = localStart + actualLength - 1;
    const globalEnd = start + actualLength - 1;

    const cdnUrl = await resolveChunkUrlWithFallback(targetChunk);
    if (!cdnUrl) return apiResponse.error(ctx, "Failed to resolve chunk URL", 502);

    const response = await fetch(cdnUrl, {
      headers: { Range: `bytes=${localStart}-${localEnd}` },
    });

    if (!response.ok && response.status !== 206) {
      return apiResponse.error(ctx, "Upstream Error", 502);
    }

    return new Response(response.body, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${globalEnd}/${file.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": actualLength.toString(),
        "Content-Type": file.type || "application/octet-stream",
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[STREAM CRITICAL] Error for ${fileId}:`, error.message);
    return apiResponse.error(ctx, "Internal Server Error", 500);
  }
});

export default stream;