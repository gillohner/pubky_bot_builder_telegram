// src/middleware/router.ts
import {
  Composer,
  type Context,
} from "https://deno.land/x/grammy@v1.38.2/mod.ts";
import { buildSnapshot /* not implemented */ } from "../core/snapshot.ts";
import { dispatch /* not implemented */ } from "../core/dispatcher.ts";

export function buildMiddleware() {
  const composer = new Composer<Context>();

  // 1) Error boundary to guard downstream handlers
  composer.use(async (_ctx: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (err) {
      console.error("Middleware error:", err);
    }
  });

  // 2) Command normalization: accept /cmd and /cmd@BotName
  composer.on(
    "message:text",
    async (ctx: Context, next: () => Promise<void>) => {
      const text = ctx.message?.text ?? "";
      if (!text.startsWith("/")) return await next();

      const chatId = String(ctx.chat?.id ?? "");
      // Extract command token, strip leading '/', and drop optional @BotName suffix
      const token = text.split(" ")[0] ?? "";
      const command = token.replace(/^\//, "").replace(/@[^\s]+$/, "");

      // Build or fetch a routing snapshot (placeholder)
      await buildSnapshot(chatId);

      // Dispatch to a service based on the snapshot (placeholder)
      await dispatch({
        kind: "command",
        command,
        ctx: {
          chatId,
          userId: String(ctx.from?.id ?? ""),
        },
      });

      // Send a generic placeholder response
      await ctx.reply("Command received and forwarded.");
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
    await dispatch({
      kind: "callback",
      data,
      ctx: {
        chatId,
        userId: String(ctx.from?.id ?? ""),
      },
    });
    await ctx.answerCallbackQuery();
  });

  // 6) Generic message listeners (forward as messages)
  composer.on("message", async (ctx: Context, next: () => Promise<void>) => {
    const chatId = String(ctx.chat?.id ?? "");
    await buildSnapshot(chatId);
    await dispatch({
      kind: "message",
      message: ctx.message,
      ctx: {
        chatId,
        userId: String(ctx.from?.id ?? ""),
      },
    });
    await next();
    await ctx.reply("Message received and forwarded.");
  });

  return composer;
}
