// src/middleware/router.ts
import { Composer, type Context } from "grammy";
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { dispatch } from "@core/dispatch/dispatcher.ts";
import { applyServiceResponse } from "./response.ts";
import { normalizeCommand, isBotCommand } from "@/core/util/utils.ts";
import { log } from "@/core/util/logger.ts";

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

  // 2) Command normalization: accept /cmd and /cmd@BotName
  composer.on(
    "message:text",
    async (ctx: Context, next: () => Promise<void>) => {
      const text = ctx.message?.text ?? "";
      if (!isBotCommand(text)) return await next();

      const chatId = String(ctx.chat?.id ?? "");
      // Extract command token, strip leading '/', and drop optional @BotName suffix
      const token = text.split(" ")[0] ?? "";
      const command = normalizeCommand(token.replace(/@[^\s]+$/, ""));

      log.error("middleware.command", { command, chatId });

      // Build or fetch a routing snapshot (placeholder)
      await buildSnapshot(chatId);

      // Dispatch to a service based on the snapshot and translate response
      const result = await dispatch({
        kind: "command",
        command,
        ctx: { chatId, userId: String(ctx.from?.id ?? "") },
      });
      await applyServiceResponse(ctx, result.response);
    }
  );

  // 3) Admin/auth checks or chat-scoped checks could be inserted here
  //    (left as future work; keep this layer for modularity)

  // 4) (Handled above inside message:text). Keeping this slot for future routing.

  // 5) Callback queries (inline keyboards) forwarder
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

  // 6) Generic message listeners (forward as messages)
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
