import { Hono } from "hono";
import db from "../db";
import { logger } from "../lib/logger";
import { resolveChunkUrlWithFallback } from "../lib/refresh-url";
import { apiResponse } from "../lib/response";
import type { ChunkMetadata, FileMetadata } from "../types";

const stream = new Hono<{ Variables: { mediaToken?: { fileId: string } } }>();

stream.get("/file/:id", async (ctx) => {
  const fileId = ctx.req.param("id");

  // A media token only grants access to the file it was issued for
  const mediaToken = ctx.get("mediaToken");
  if (mediaToken && mediaToken.fileId !== fileId) {
    return apiResponse.error(ctx, "Unauthorized", 401);
  }

  const rangeHeader = ctx.req.header("Range");

  try {
    const file = db.prepare("SELECT size, name, type FROM files WHERE id = ?").get(fileId) as FileMetadata | undefined;
    if (!file) return apiResponse.error(ctx, "File not found", 404);

    let start = 0;
    let end = file.size - 1;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      if (isNaN(start)) {
        // suffix range: bytes=-N means the last N bytes
        const suffix = parseInt(parts[1], 10);
        if (isNaN(suffix) || suffix <= 0) {
          ctx.header("Content-Range", `bytes */${file.size}`);
          return apiResponse.error(ctx, "Range Not Satisfiable", 416);
        }
        start = Math.max(0, file.size - suffix);
        end = file.size - 1;
      } else {
        if (parts[1]) end = parseInt(parts[1], 10);
        if (isNaN(end)) end = file.size - 1;
        end = Math.min(end, file.size - 1);
      }
    }

    if (start > end || start >= file.size) {
      ctx.header("Content-Range", `bytes */${file.size}`);
      return apiResponse.error(ctx, "Range Not Satisfiable", 416);
    }

    const chunks = db
      .prepare("SELECT idx, size, url, message_id, channel_id FROM chunks WHERE file_id = ? ORDER BY idx ASC")
      .all(fileId) as ChunkMetadata[];

    // Map the requested [start, end] onto per-chunk segments (a range may span
    // several chunks — e.g. video seeking across a chunk boundary)
    const segments: { chunk: ChunkMetadata; start: number; end: number }[] = [];
    let offset = 0;
    for (const chunk of chunks) {
      const chunkEnd = offset + chunk.size - 1;
      if (chunkEnd < start) {
        offset += chunk.size;
        continue;
      }
      segments.push({
        chunk,
        start: Math.max(start, offset) - offset,
        end: Math.min(end, chunkEnd) - offset,
      });
      if (chunkEnd >= end) break;
      offset += chunk.size;
    }

    if (segments.length === 0) {
      ctx.header("Content-Range", `bytes */${file.size}`);
      return apiResponse.error(ctx, "Range Not Satisfiable", 416);
    }

    // Fetch the first segment eagerly so upstream failures surface as a 502
    const first = segments[0];
    const firstUrl = await resolveChunkUrlWithFallback(first.chunk);
    if (!firstUrl) return apiResponse.error(ctx, "Failed to resolve chunk URL", 502);
    const firstRes = await fetch(firstUrl, {
      headers: { Range: `bytes=${first.start}-${first.end}` },
      signal: AbortSignal.timeout(120_000),
    });
    if (!firstRes.ok && firstRes.status !== 206) {
      return apiResponse.error(ctx, "Upstream Error", 502);
    }

    // Stream the remaining segments lazily, one read at a time, so enqueuing
    // respects backpressure and we never buffer whole chunks in memory.
    // Pull state is captured here (NOT inside pull()) so successive pulls
    // continue from where the previous one stopped.
    let segIndex = 0;
    let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | null = null;
    let nextRes: Response | null = firstRes;

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          // Local copy so TS narrows past the block; `reader` stays in sync.
          let current = reader;
          if (!current) {
            if (segIndex >= segments.length) {
              controller.close();
              return;
            }
            if (!nextRes) {
              const seg = segments[segIndex];
              const url = await resolveChunkUrlWithFallback(seg.chunk);
              if (!url) {
                controller.error(new Error("Failed to resolve chunk URL"));
                return;
              }
              nextRes = await fetch(url, {
                headers: { Range: `bytes=${seg.start}-${seg.end}` },
                signal: AbortSignal.timeout(120_000),
              });
              if (!nextRes.ok && nextRes.status !== 206) {
                controller.error(new Error("Upstream error"));
                return;
              }
            }
            const res = nextRes;
            nextRes = null;
            if (!res.body) {
              controller.error(new Error("Upstream has no body"));
              return;
            }
            current = res.body.getReader() as ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
            reader = current;
          }
          // Guard for control-flow narrowing: `current` is either the value
          // from before the block or the freshly assigned reader above.
          if (!current) {
            controller.error(new Error("No reader available"));
            return;
          }
          const { done, value } = await current.read();
          if (done) {
            current.releaseLock();
            reader = null;
            segIndex++;
            continue;
          }
          controller.enqueue(value);
          return;
        }
      },
    });

    // Media elements (<img>/<video>) get inline; plain downloads get attachment,
    // so the response is a real file even cross-origin (where the download attr
    // on <a> is ignored).
    const disposition = ctx.req.query("inline") === "true" ? "inline" : "attachment";
    const encodedFilename = encodeURIComponent(file.name);

    return new Response(body, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${file.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": (end - start + 1).toString(),
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[STREAM CRITICAL] Error for ${fileId}:`, error.message);
    return apiResponse.error(ctx, "Internal Server Error", 500);
  }
});

export default stream;