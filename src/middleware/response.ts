// src/middleware/response.ts
// Helper to translate a ServiceResponse into grammY actions. This keeps the
// routing middleware lean and creates a single expansion point for future
// response kinds (e.g., media, keyboards, batched messages).

import type { Context } from "grammy";
import type {
	ServiceReplyDelete,
	ServiceReplyEdit,
	ServiceReplyMessage,
	ServiceReplyPhoto,
	ServiceResponse,
} from "@/core/service_types.ts";
import { log } from "@/core/util/logger.ts";

// Narrow helper type (subset of common reply/edit options). Extend as needed.
type BasicMessageOptions = Record<string, unknown> | undefined;

export async function applyServiceResponse(
	ctx: Context,
	resp: ServiceResponse | null,
): Promise<void> {
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
			// delete kind already deletes triggering message; do not double-delete
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

async function handleReply(ctx: Context, r: ServiceReplyMessage) {
	// r.options is an arbitrary serialisable map; spread into a new object to satisfy typing
	await ctx.reply(
		r.text,
		r.options ? { ...(r.options as Record<string, unknown>) } : undefined,
	);
}

async function handleEdit(ctx: Context, r: ServiceReplyEdit) {
	// For now attempt to edit the message that triggered the update when possible.
	// If editing fails (e.g., original not found), fall back to sending a new reply.
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
		// Telegram returns 400 with description 'Bad Request: message is not modified'
		// when the edit doesn't change content or markup. Treat as benign no-op.
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
			return; // suppress fallback reply to avoid duplicate message
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
		log.error("Photo send failed", { error: err });
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
		// No message id available: optionally fallback
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
