import { logger } from "./logger";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BACKUP_CHANNEL_ID = process.env.DISCORD_BACKUP_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;

/**
 * Uploads the SQLite database to Discord as a backup
 */
export async function backupDatabase() {
  if (!BOT_TOKEN || !BACKUP_CHANNEL_ID) {
    logger.warn("Skipping backup: Missing configuration");
    return;
  }

  try {
    const buffer = await Bun.file("neko.db").arrayBuffer();
    const timestamp = Math.floor(Date.now() / 1000);
    const prefix = "📦 **Neko Drive Automated Backup**";

    // 1. Fetch recent messages to find old backups
    const listRes = await fetch(`https://discord.com/api/v10/channels/${BACKUP_CHANNEL_ID}/messages?limit=10`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });

    if (listRes.ok) {
      const messages = (await listRes.json()) as { id: string; content: string }[];
      const oldBackups = messages.filter((msg) => msg.content.startsWith(prefix));

      if (oldBackups.length > 0) {
        logger.debug(`Cleaning up ${oldBackups.length} legacy backups...`);
        for (const msg of oldBackups) {
          await fetch(`https://discord.com/api/v10/channels/${BACKUP_CHANNEL_ID}/messages/${msg.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
          }).catch(() => {}); // Best effort cleanup
        }
      }
    }

    // 2. Upload New Backup
    const formData = new FormData();
    formData.append("files[0]", new Blob([buffer]), `neko_backup_${timestamp}.db`);
    formData.append("content", `${prefix}\nTime: <t:${timestamp}:F>`);

    const response = await fetch(`https://discord.com/api/v10/channels/${BACKUP_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Backup Upload Failed: ${response.status}`);
    }

    logger.info(`Database backed up successfully to Discord`);
  } catch (error: unknown) {
    logger.error("Error during automated backup:", error instanceof Error ? error.message : error);
  }
}
