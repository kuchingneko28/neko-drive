/**
 * Discord Librarian Helper (Native fetch-based)
 * Handles communication with Discord API for object storage.
 */

import { logger } from "./logger";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!BOT_TOKEN || !CHANNEL_ID) {
  logger.warn("Missing BOT_TOKEN or CHANNEL_ID in .env");
}

export interface DiscordAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
}

/**
 * Upload an ArrayBuffer as an attachment to Discord
 */
export async function uploadToDiscord(
  buffer: ArrayBuffer,
  filename: string,
  signal?: AbortSignal,
): Promise<DiscordAttachment> {
  const formData = new FormData();
  formData.append("files[0]", new Blob([buffer]), filename);

  const response = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord Upload Failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const attachment = data.attachments?.[0];
  if (!attachment) throw new Error("Discord returned no attachments");

  return {
    id: data.id,
    url: attachment.url,
    filename: attachment.filename,
    size: attachment.size,
  };
}

/**
 * Bulk delete messages from Discord (optimized Librarian protocol)
 * Uses high-speed bulk-delete for recent messages (up to 100 per req)
 * and falls back to concurrent individual deletions for older chunks.
 */
export async function bulkDeleteFromDiscord(messageIds: string[]) {
  if (messageIds.length === 0) return;

  logger.info(`Bulk Deletion started: ${messageIds.length} chunks`);

  // Optimization: If only 1 message, use single delete (Discord Bulk API often requires 2-100)
  if (messageIds.length === 1) {
    try {
      await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${messageIds[0]}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
      });
      logger.debug(`Successfully deleted single chunk: ${messageIds[0]}`);
      return;
    } catch (err) {
      logger.error(`Failed to delete single message ${messageIds[0]}:`, err);
      return;
    }
  }

  // 1. Batch into groups of 100 (Discord API limit)
  const batches: string[][] = [];
  for (let i = 0; i < messageIds.length; i += 100) {
    batches.push(messageIds.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      // Attempt Discord's Bulk Delete endpoint
      const response = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/bulk-delete`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: batch }),
      });

      if (response.ok) {
        logger.debug(`Successfully bulk-deleted ${batch.length} chunks`);
      } else {
        // 2. Hybrid Fallback: If bulk-delete fails (likely messages > 14 days old),
        // we switch to optimized parallel individual deletions.
        logger.warn(`Bulk-delete failed (${response.status}), falling back to concurrent deletion`);

        // Use a concurrency limit to avoid aggressive rate limits
        const limit = 5;
        for (let i = 0; i < batch.length; i += limit) {
          const individualBatch = batch.slice(i, i + limit);
          await Promise.all(
            individualBatch.map(async (id) => {
              try {
                await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bot ${BOT_TOKEN}` },
                });
              } catch (err) {
                logger.error(`Failed to delete individual message ${id}:`, err);
              }
            }),
          );
          // Tiny cool-down between small parallel batches
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } catch (error) {
      logger.error("Bulk-delete operation encountered error:", error);
    }
  }
}

/**
 * Refresh expired Discord CDN URLs in bulk
 * Supports up to 50 URLs per request.
 */
export async function refreshDiscordUrls(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];

  const response = await fetch(`https://discord.com/api/v10/attachments/refresh-urls`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ attachment_urls: urls }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord URL Refresh Failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.refreshed_urls.map((item: { refreshed: string }) => item.refreshed);
}

/**
 * Get a fresh CDN URL for an attachment (JIT)
 */
export async function getDiscordCDNUrl(messageId: string, channelId?: string): Promise<string> {
  const chId = channelId || CHANNEL_ID;
  const response = await fetch(`https://discord.com/api/v10/channels/${chId}/messages/${messageId}`, {
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch message ${messageId}: ${response.status}`);
  }

  const data = await response.json();
  const url = data.attachments?.[0]?.url;
  if (!url) throw new Error(`Message ${messageId} has no attachments`);
  return url;
}
