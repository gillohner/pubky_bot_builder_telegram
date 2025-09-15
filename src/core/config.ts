// src/core/config.ts
// Centralized configuration access. All environment lookups happen here.

export const CONFIG = {
	env: Deno.env.get("NODE_ENV") ?? "development",
	debug: (Deno.env.get("DEBUG") ?? "").toLowerCase() === "1",
	logMinLevel: (Deno.env.get("LOG_MIN_LEVEL") ?? "info").toLowerCase(),
	logPretty: (Deno.env.get("LOG_PRETTY") ?? "0").toLowerCase() === "1",
	defaultTemplateId: Deno.env.get("DEFAULT_TEMPLATE_ID") ?? "default",
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
