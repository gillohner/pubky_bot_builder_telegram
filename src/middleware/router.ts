// src/middleware/router.ts
import { Composer, type Context } from "grammy";
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { dispatch } from "@core/dispatch/dispatcher.ts";
import { applyServiceResponse } from "@middleware/response.ts";
import { isBotCommand, normalizeCommand } from "@/core/util/utils.ts";
import { log } from "@/core/util/logger.ts";
import { fetchPubkyConfig } from "@core/pubky/pubky.ts";
import { deleteSnapshot, setChatConfig } from "@core/config/store.ts";
import { userIsAdmin } from "@middleware/admin.ts";

// Non-admin commands exposed to users (dynamic services appended later via snapshot)
const CORE_PUBLIC_COMMANDS: string[] = ["start"]; // plus service commands resolved dynamically
const CORE_ADMIN_COMMANDS = new Set(["setconfig", "updateconfig"]);

async function publishCommands(ctx: Context, chatId: string) {
	try {
		const snap = await buildSnapshot(chatId);
		const serviceCommands = Object.keys(snap.commands);
		const commandList = [...new Set([...CORE_PUBLIC_COMMANDS, ...serviceCommands])]
			.filter((c) => !CORE_ADMIN_COMMANDS.has(c))
			.map((c) => ({ command: c, description: c }));
		if (commandList.length > 0) {
			await ctx.api.setMyCommands(commandList, {
				scope: { type: "chat", chat_id: Number(chatId) },
			});
		}
	} catch (err) {
		log.warn("commands.publish.error", { error: (err as Error).message });
	}
}

export function buildMiddleware() {
	const composer = new Composer<Context>();

	// 1) Error boundary to guard downstream handlers
	composer.use(async (_ctx: Context, next: () => Promise<void>) => {
		try {
			await next();
		} catch (err) {
			log.error("middleware.error", { error: (err as Error).message });
		}
	});

	composer.on(
		"message:text",
		async (ctx: Context, next: () => Promise<void>) => {
			const text = ctx.message?.text ?? "";
			if (!isBotCommand(text)) return await next();

			const chatId = String(ctx.chat?.id ?? "");
			// Extract command token, strip leading '/', and drop optional @BotName suffix
			const token = text.split(" ")[0] ?? "";
			const command = normalizeCommand(token.replace(/@[^\s]+$/, ""));

			// /start (always allowed)
			if (command === "start") {
				await publishCommands(ctx, chatId);
				await ctx.reply(
					"Hi! Commands are now available. Use /setconfig <template> (admins) to set bot config.",
				);
				return;
			}

			// Handle administrative config commands inline (admin only)
			if (command === "setconfig") {
				if (!(await userIsAdmin(ctx))) {
					await ctx.reply("Admin only.");
					return;
				}
				const parts = text.trim().split(/\s+/);
				if (parts.length < 2) {
					await ctx.reply("Usage: /setconfig <templateId>");
					return;
				}
				const templateId = normalizeCommand(parts[1]!);
				try {
					const cfg = fetchPubkyConfig(templateId);
					setChatConfig(chatId, cfg.configId, cfg);
					deleteSnapshot(chatId); // invalidate persisted snapshot; force rebuild next usage
					await ctx.reply(`Config set to '${cfg.configId}'. Run /updateconfig to rebuild.`);
				} catch (err) {
					await ctx.reply(`Config error: ${(err as Error).message}`);
				}
				return;
			}
			if (command === "updateconfig") {
				if (!(await userIsAdmin(ctx))) {
					await ctx.reply("Admin only.");
					return;
				}
				// Force rebuild snapshot using current config
				try {
					await buildSnapshot(chatId, { force: true });
					await publishCommands(ctx, chatId);
					await ctx.reply("Snapshot updated.");
				} catch (err) {
					await ctx.reply(`Update failed: ${(err as Error).message}`);
				}
				return;
			}

			// Build or fetch a routing snapshot (placeholder)
			await buildSnapshot(chatId);

			// Dispatch to a service based on the snapshot and translate response
			const result = await dispatch({
				kind: "command",
				command,
				ctx: { chatId, userId: String(ctx.from?.id ?? "") },
			});
			await applyServiceResponse(ctx, result.response);
		},
	);

	// Callback queries (inline keyboards) forwarder
	composer.on("callback_query:data", async (ctx: Context) => {
		const chatId = String(ctx.chat?.id ?? "");
		const data = ctx.callbackQuery?.data ?? "";
		await buildSnapshot(chatId);
		const result = await dispatch({
			kind: "callback",
			data,
			ctx: { chatId, userId: String(ctx.from?.id ?? "") },
		});
		await applyServiceResponse(ctx, result.response);
		await ctx.answerCallbackQuery();
		log.debug("callback.processed", { chatId, data });
	});

	// Generic message listeners (forward as messages)
	composer.on("message", async (ctx: Context, next: () => Promise<void>) => {
		const chatId = String(ctx.chat?.id ?? "");
		await buildSnapshot(chatId);
		const result = await dispatch({
			kind: "message",
			message: ctx.message,
			ctx: { chatId, userId: String(ctx.from?.id ?? "") },
		});
		await applyServiceResponse(ctx, result.response);
		await next();
		log.debug("message.processed", { chatId });
	});

	return composer;
}
