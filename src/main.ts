// src/main.ts
import bot from "./bot.ts";
import { webhookCallback } from "grammy";
import { cleanupAll } from "@core/ttl/store.ts";
import { log } from "@core/util/logger.ts";

async function startupTtlCleanup() {
	try {
		const removed = await cleanupAll(async (m) => {
			if (m.platform === "telegram") {
				try {
					// Best effort API call; we have bot instance already so use raw api
					await bot.api.deleteMessage(m.chatId as number, m.messageId);
				} catch (err) {
					log.debug("ttl.startup.delete.failed", { error: (err as Error).message });
				}
			}
		});
		if (removed) log.info("ttl.startup.cleaned", { removed });
	} catch (err) {
		log.warn("ttl.startup.cleanup.failed", { error: (err as Error).message });
	}
}

if (import.meta.main) {
	const useWebhook = Deno.env.get("WEBHOOK") === "1";
	await startupTtlCleanup();
	if (useWebhook) {
		const handle = webhookCallback(bot, "std/http");
		Deno.serve((req) => {
			const url = new URL(req.url);
			if (req.method === "POST" && url.pathname === `/${bot.token}`) {
				return handle(req);
			}
			return new Response("OK");
		});
	} else {
		console.log("🤖 Starting bot in polling mode...");
		await bot.start();
		console.log("✅ Bot started successfully and is polling for updates");
	}
}
