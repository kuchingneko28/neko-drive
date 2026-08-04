import { Hono } from "hono";
import db from "../db";
import { logger } from "../lib/logger";
import { resolveChunkUrlWithFallback } from "../lib/refresh-url";
import { apiResponse } from "../lib/response";
import type { ChunkMetadata, FileMetadata } from "../types";

const download = new Hono<{ Variables: { mediaToken?: { fileId: string } } }>();

download.get("/:id", async (ctx) => {
  const fileId = ctx.req.param("id");

  // A media token only grants access to the file it was issued for
  const mediaToken = ctx.get("mediaToken");
  if (mediaToken && mediaToken.fileId !== fileId) {
    return apiResponse.error(ctx, "Unauthorized", 401);
  }

  try {
    const file = db.prepare("SELECT id, name, size, type FROM files WHERE id = ?").get(fileId) as
      | FileMetadata
      | undefined;
    if (!file) return apiResponse.error(ctx, "File not found", 404);

    const chunks = db
      .prepare("SELECT idx, size, url, message_id FROM chunks WHERE file_id = ? ORDER BY idx ASC")
      .all(fileId) as ChunkMetadata[];

    if (chunks.length === 0) return apiResponse.error(ctx, "File has no chunks", 404);

    const chunkIndexStr = ctx.req.query("index");
    if (chunkIndexStr !== undefined) {
      const idx = parseInt(chunkIndexStr, 10);
      const chunk = chunks.find((ch) => ch.idx === idx);
      if (!chunk) return apiResponse.error(ctx, "Chunk not found", 404);

      const cdnUrl = await resolveChunkUrlWithFallback(chunk);
      if (!cdnUrl) return apiResponse.error(ctx, "Failed to get chunk URL", 502);

      const response = await fetch(cdnUrl, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) return apiResponse.error(ctx, `Discord fetch failed: ${response.status}`, 502);

      return new Response(response.body, {
        headers: {
          "Content-Length": chunk.size.toString(),
          "Content-Type": "application/octet-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const totalEncryptedSize = chunks.reduce((acc, ch) => acc + ch.size, 0);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    ;(async () => {
      try {
        const fetchChunkData = async (chunk: ChunkMetadata) => {
          if (ctx.req.raw.signal.aborted) throw new Error("Client aborted");

          let attempt = 0;
          const MAX_ATTEMPTS = 2;

          while (attempt < MAX_ATTEMPTS) {
            attempt++;

            const cdnUrl = await resolveChunkUrlWithFallback(chunk);
            if (!cdnUrl) throw new Error("No URL available for chunk");
            if (ctx.req.raw.signal.aborted) throw new Error("Client aborted");

            try {
              const response = await fetch(cdnUrl, { signal: AbortSignal.timeout(120000) });

              if (!response.ok) {
                if ((response.status === 403 || response.status === 410) && attempt < MAX_ATTEMPTS) continue;
                throw new Error(`Fetch failed: ${response.status}`);
              }

              return response;
            } catch (err: unknown) {
              if (ctx.req.raw.signal.aborted) throw new Error("Client aborted");
              const msg = err instanceof Error ? err.message : String(err);
              if (attempt < MAX_ATTEMPTS) {
                await new Promise((r) => setTimeout(r, 1000));
                continue;
              }
              throw err;
            }
          }
          throw new Error("Unreachable");
        };

        const startChunkIndex = parseInt(ctx.req.query("start_chunk") || "0", 10);
        const filteredChunks = chunks.filter((ch) => ch.idx >= startChunkIndex);

        const WINDOW_SIZE = 3;
        const promises: Array<Promise<Response> | null> = new Array(filteredChunks.length).fill(null);

        for (let i = 0; i < Math.min(WINDOW_SIZE, filteredChunks.length); i++) {
          promises[i] = fetchChunkData(filteredChunks[i]);
        }

        for (let i = 0; i < filteredChunks.length; i++) {
          if (ctx.req.raw.signal.aborted) throw new Error("Client aborted");

          const response = await promises[i];
          if (!response) throw new Error(`Chunk ${filteredChunks[i].idx} data missing`);

          promises[i] = null;
          const next = i + WINDOW_SIZE;
          if (next < filteredChunks.length) {
            promises[next] = fetchChunkData(filteredChunks[next]);
          }

          // Stream the CDN body through directly — buffering the whole chunk
          // (arrayBuffer) delays the first byte to the client until the CDN
          // transfer finishes, which looks like a stuck download on slow links.
          if (!response.body) throw new Error(`Chunk ${filteredChunks[i].idx} has no body`);
          const reader = response.body.getReader();
          while (true) {
            if (ctx.req.raw.signal.aborted) throw new Error("Client aborted");
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        }

        await writer.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Client aborted") {
          logger.info(`[STREAM ABORT] File ${fileId} cancelled by client`);
        } else if (msg !== "undefined") {
          logger.error(`[STREAM CRITICAL] File ${fileId} failed:`, msg);
        }
        writer.abort(err).catch(() => {});
      }
    })();

    const disposition = ctx.req.query("inline") === "true" ? "inline" : "attachment";
    const encodedFilename = encodeURIComponent(file.name);

    return new Response(readable, {
      headers: {
        "Content-Length": totalEncryptedSize.toString(),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedFilename}`,
        "Content-Type": file.type || "application/octet-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    logger.error("Download Error", error);
    return apiResponse.error(ctx, "Internal Server Error", 500);
  }
});

export default download;