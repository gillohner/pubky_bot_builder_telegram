// src/bot.ts
import { Bot } from "grammy";
import { clearAllSnapshots, getDb, initDb } from "@core/config/store.ts";
import { buildMiddleware } from "@middleware/router.ts";
import { pubkyWriter } from "@core/pubky/writer.ts";
import { setWriterDb } from "@core/pubky/writer_store.ts";

const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("BOT_TOKEN is required");

// Initialize persistent stores (configs & snapshots)
initDb();
// Clear stale snapshots so first request rebuilds with fresh code/config
clearAllSnapshots();

export const bot = new Bot(token);

// Initialize PubkyWriter with database and bot API
setWriterDb(getDb());
pubkyWriter.initialize().then((ready) => {
	if (ready) {
		// Inject bot API for sending messages
		pubkyWriter.setBotApi({
			sendMessage: (chatId, text, options) =>
				bot.api.sendMessage(chatId, text, options as Parameters<typeof bot.api.sendMessage>[2]),
			editMessageText: async (chatId, messageId, text, options) => {
				await bot.api.editMessageText(
					chatId,
					messageId,
					text,
					options as Parameters<typeof bot.api.editMessageText>[3],
				);
			},
		});
	}
});

// Attach composed middleware that forwards to snapshot/dispatcher stubs
bot.use(buildMiddleware());

export default bot;
