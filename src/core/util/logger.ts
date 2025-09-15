// src/core/logger.ts
import { CONFIG, getMinLevel, isDebug, isProd } from "@core/config.ts";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

function shouldLog(level: Level): boolean {
	if (isProd()) return false;
	const min = getMinLevel();
	if (level === "debug" && !isDebug()) return false;
	return LEVEL_ORDER[level] >= LEVEL_ORDER[min];
}

function formatLine(
	level: Level,
	msg: string,
	meta?: Record<string, unknown>,
): string {
	const rec: Record<string, unknown> = {
		ts: new Date().toISOString(),
		level,
		msg,
	};
	if (meta && Object.keys(meta).length) rec.meta = meta;
	if (CONFIG.logPretty && !isProd()) {
		const base = `[${rec.ts}] ${level.toUpperCase()} ${msg}`;
		return meta ? base + " " + JSON.stringify(meta) : base;
	}
	return JSON.stringify(rec);
}

function out(level: Level, msg: string, meta?: Record<string, unknown>) {
	if (!shouldLog(level)) return;
	const line = formatLine(level, msg, meta);
	if (level === "error") {
		console.error(line);
		return;
	}
	if (level === "warn") {
		console.warn(line);
		return;
	}
	// info & debug
	console.log(line);
}

export const log = {
	info: (m: string, meta?: Record<string, unknown>) => out("info", m, meta),
	warn: (m: string, meta?: Record<string, unknown>) => out("warn", m, meta),
	error: (m: string, meta?: Record<string, unknown>) => out("error", m, meta),
	debug: (m: string, meta?: Record<string, unknown>) => out("debug", m, meta),
};
