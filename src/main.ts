// src/main.ts
import bot from "./bot.ts";
import { webhookCallback } from "grammy";

const useWebhook = Deno.env.get("WEBHOOK") === "1";

if (useWebhook) {
	const handle = webhookCallback(bot, "std/http");
	Deno.serve((req) => {
		const url = new URL(req.url);
		// Optional secret path based on token; adjust as needed
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
