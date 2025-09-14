// src/middleware/response.ts
// Helper to translate a ServiceResponse into grammY actions. This keeps the
// routing middleware lean and creates a single expansion point for future
// response kinds (e.g., media, keyboards, batched messages).

import type { Context } from "grammy";
import type {
  ServiceResponse,
  ServiceReplyMessage,
  ServiceReplyEdit,
  ServiceReplyPhoto,
} from "@/core/service_types.ts";
import { log } from "@/core/util/logger.ts";

// Narrow helper type (subset of common reply/edit options). Extend as needed.
type BasicMessageOptions = Record<string, unknown> | undefined;

export async function applyServiceResponse(
  ctx: Context,
  resp: ServiceResponse | null
): Promise<void> {
  if (!resp) return;
  switch (resp.kind) {
    case "reply":
      await handleReply(ctx, resp);
      return;
    case "edit":
      await handleEdit(ctx, resp);
      return;
    case "error":
      await ctx.reply(`⚠️ ${resp.message}`);
      return;
    case "photo":
      await handlePhoto(ctx, resp);
      return;
    case "none":
    default:
      return;
  }
}

async function handleReply(ctx: Context, r: ServiceReplyMessage) {
  // r.options is an arbitrary serialisable map; spread into a new object to satisfy typing
  await ctx.reply(
    r.text,
    r.options ? { ...(r.options as Record<string, unknown>) } : undefined
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
          : undefined) as BasicMessageOptions
      );
    } else if (ctx.msg?.message_id) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        ctx.msg.message_id,
        r.text,
        (r.options
          ? { ...(r.options as Record<string, unknown>) }
          : undefined) as BasicMessageOptions
      );
    } else {
      await ctx.reply(
        r.text,
        r.options ? { ...(r.options as Record<string, unknown>) } : undefined
      );
    }
  } catch (err) {
    log.warn("Edit fallback -> reply", { error: err });
    await ctx.reply(
      r.text,
      r.options ? { ...(r.options as Record<string, unknown>) } : undefined
    );
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
