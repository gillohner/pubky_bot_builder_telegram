// src/bot.ts
import { Bot } from "grammy";
import { buildMiddleware } from "@middleware/router.ts";

const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Bot(token);

// A trivial health command to confirm the bot runs
bot.command("start", (ctx) => ctx.reply("Bot is running."));

// Attach composed middleware that forwards to snapshot/dispatcher stubs
bot.use(buildMiddleware());

export default bot;
