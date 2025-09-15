// src/adapters/telegram/adapter.ts
// Telegram platform adapter implementing PlatformAdapter interface.
import type { Context } from "grammy";
import type {
	ServiceReplyDelete,
	ServiceReplyEdit,
	ServiceReplyMessage,
	ServiceReplyPhoto,
	ServiceResponse,
} from "@core/service_types.ts";
import { log } from "@core/util/logger.ts";
import type { AdapterApplyContext, PlatformAdapter } from "@adapters/types.ts";

// Narrow helper type for edit options compatibility
type BasicMessageOptions = Record<string, unknown> | undefined;

async function handleReply(ctx: Context, r: ServiceReplyMessage) {
	await ctx.reply(
		r.text,
		r.options ? { ...(r.options as Record<string, unknown>) } : undefined,
	);
}

async function handleEdit(ctx: Context, r: ServiceReplyEdit) {
	try {
		if (ctx.callbackQuery?.message) {
			const msg = ctx.callbackQuery.message;
			await ctx.api.editMessageText(
				ctx.chat!.id,
				msg.message_id,
				r.text,
				(r.options
					? { ...(r.options as Record<string, unknown>) }
					: undefined) as BasicMessageOptions,
			);
		} else if (ctx.msg?.message_id) {
			await ctx.api.editMessageText(
				ctx.chat!.id,
				ctx.msg.message_id,
				r.text,
				(r.options
					? { ...(r.options as Record<string, unknown>) }
					: undefined) as BasicMessageOptions,
			);
		} else {
			await ctx.reply(
				r.text,
				r.options ? { ...(r.options as Record<string, unknown>) } : undefined,
			);
		}
	} catch (err: unknown) {
		type WithDescription = { description: string };
		const maybe = err as unknown;
		let desc = "";
		if (typeof maybe === "object" && maybe !== null) {
			if (
				"description" in maybe &&
				typeof (maybe as WithDescription).description === "string"
			) {
				desc = (maybe as WithDescription).description;
			} else if (maybe instanceof Error && typeof maybe.message === "string") {
				desc = maybe.message;
			}
		} else if (maybe instanceof Error) {
			desc = maybe.message;
		}
		if (/message is not modified/i.test(desc)) {
			log.debug("edit.noop", { reason: desc });
			return;
		}
		log.warn("edit.fallback.reply", { error: err });
		try {
			await ctx.reply(
				r.text,
				r.options ? { ...(r.options as Record<string, unknown>) } : undefined,
			);
		} catch (replyErr) {
			log.error("edit.fallback.failed", { error: replyErr });
		}
	}
}

async function handlePhoto(ctx: Context, r: ServiceReplyPhoto) {
	try {
		await ctx.replyWithPhoto(r.photo, {
			caption: r.caption,
			...(r.options as Record<string, unknown> | undefined),
		});
	} catch (err) {
		log.error("photo.send.failed", { error: err });
		await ctx.reply(r.caption ?? "(photo failed)");
	}
}

async function handleDelete(ctx: Context, r: ServiceReplyDelete) {
	try {
		const msg = ctx.callbackQuery?.message || ctx.msg;
		if (msg?.message_id) {
			await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id);
			return;
		}
		if (r.fallbackText) {
			await ctx.reply(
				r.fallbackText,
				r.options ? { ...(r.options as Record<string, unknown>) } : undefined,
			);
		}
	} catch (err) {
		log.warn("delete.failed", { error: err });
		if (r.fallbackText) {
			try {
				await ctx.reply(
					r.fallbackText,
					r.options ? { ...(r.options as Record<string, unknown>) } : undefined,
				);
			} catch (replyErr) {
				log.error("delete.fallback.failed", { error: replyErr });
			}
		}
	}
}

async function applyResponseInternal(ctx: Context, resp: ServiceResponse | null): Promise<void> {
	if (!resp) return;
	let shouldDeleteTrigger = false;
	if ("deleteTrigger" in resp && resp.deleteTrigger) {
		shouldDeleteTrigger = true;
	}
	switch (resp.kind) {
		case "reply":
			await handleReply(ctx, resp);
			break;
		case "edit":
			await handleEdit(ctx, resp);
			break;
		case "delete":
			await handleDelete(ctx, resp);
			shouldDeleteTrigger = false;
			break;
		case "error":
			await ctx.reply(`⚠️ ${resp.message}`);
			break;
		case "photo":
			await handlePhoto(ctx, resp);
			break;
		case "none":
		default:
			return;
	}
	if (shouldDeleteTrigger) {
		try {
			const msg = ctx.msg || ctx.callbackQuery?.message;
			if (msg?.message_id) {
				await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id);
			}
		} catch (err) {
			log.debug("deleteTrigger.failed", { error: (err as Error).message });
		}
	}
}

export const telegramAdapter: PlatformAdapter = {
	id: "telegram",
	async applyResponse(ctx: AdapterApplyContext, resp: ServiceResponse | null) {
		await applyResponseInternal(ctx.platformCtx as Context, resp);
	},
};
