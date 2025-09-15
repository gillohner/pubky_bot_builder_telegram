// src/bot.ts
import { Bot } from "grammy";
import { initDb } from "@core/config/store.ts";
import { buildMiddleware } from "@middleware/router.ts";

const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("BOT_TOKEN is required");

// Initialize persistent stores (configs & snapshots)
initDb();

export const bot = new Bot(token);

// Attach composed middleware that forwards to snapshot/dispatcher stubs
bot.use(buildMiddleware());

export default bot;
