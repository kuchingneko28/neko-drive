import db from "../db";
import { getDiscordCDNUrl, refreshDiscordUrls } from "./discord";
import { logger } from "./logger";
import type { ChunkMetadata } from "../types";

const BACKUP_CHANNEL_ID = process.env.DISCORD_BACKUP_CHANNEL_ID;
const PRIMARY_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

function isUrlExpiringSoon(url: string): boolean {
  const exMatch = url.match(/[?&]ex=([0-9a-fA-F]+)/);
  if (!exMatch) return true;
  const expiry = parseInt(exMatch[1], 16);
  return expiry < Math.floor(Date.now() / 1000) + 300;
}

export async function resolveChunkUrlWithFallback(chunk: ChunkMetadata): Promise<string | null> {
  const { url, message_id, channel_id } = chunk;

  if (url && !isUrlExpiringSoon(url)) return url;

  const channelIds = [channel_id || PRIMARY_CHANNEL_ID];
  if (BACKUP_CHANNEL_ID && BACKUP_CHANNEL_ID !== PRIMARY_CHANNEL_ID) {
    channelIds.push(BACKUP_CHANNEL_ID);
  }

  for (const chId of channelIds) {
    try {
      if (url) {
        try {
          const refreshed = await refreshDiscordUrls([url]);
          if (refreshed[0]) {
            const newUrl = refreshed[0];
            db.run("UPDATE chunks SET url = ? WHERE message_id = ?", [newUrl, message_id]);
            return newUrl;
          }
        } catch {
          /* fall through to JIT */
        }
      }

      if (message_id && chId) {
        const newUrl = await getDiscordCDNUrl(message_id, chId);
        if (newUrl) {
          db.run("UPDATE chunks SET url = ?, channel_id = ? WHERE message_id = ?", [newUrl, chId, message_id]);
          return newUrl;
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to refresh URL for chunk ${chunk.idx} on channel ${chId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return null;
}