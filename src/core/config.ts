// src/core/config.ts
// Centralized configuration access. All environment lookups happen here.

export const CONFIG = {
	env: Deno.env.get("NODE_ENV") ?? "development",
	debug: (Deno.env.get("DEBUG") ?? "").toLowerCase() === "1",
	logMinLevel: (Deno.env.get("LOG_MIN_LEVEL") ?? "info").toLowerCase(),
	logPretty: (Deno.env.get("LOG_PRETTY") ?? "0").toLowerCase() === "1",
	defaultTemplateId: Deno.env.get("DEFAULT_TEMPLATE_ID") ?? "default",
	enableDeletePinned: (Deno.env.get("ENABLE_DELETE_PINNED") ?? "0").toLowerCase() === "1",
	defaultMessageTtl: Number(Deno.env.get("DEFAULT_MESSAGE_TTL") ?? "300"), // in seconds (default: 5 min, 0 to disable)
	/** Comma-separated Telegram user IDs allowed to use admin commands (setconfig, updateconfig).
	 *  These users are always admin in any chat. In groups, Telegram chat admins also have access. */
	botAdminIds: (Deno.env.get("BOT_ADMIN_IDS") ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
	/** Whether to lock DM config (prevent non-bot-owners from using /setconfig in DMs).
	 *  "1" = locked (only BOT_ADMIN_IDS can change DM config), "0" = open (old behavior). */
	lockDmConfig: (Deno.env.get("LOCK_DM_CONFIG") ?? "0").toLowerCase() === "1",
};

export function isProd() {
	return CONFIG.env === "production";
}
export function isDebug() {
	return CONFIG.debug && !isProd();
}

export type LogMinLevel = "debug" | "info" | "warn" | "error";
export function getMinLevel(): LogMinLevel {
	const v = CONFIG.logMinLevel;
	return ["debug", "info", "warn", "error"].includes(v) ? (v as LogMinLevel) : "info";
}
