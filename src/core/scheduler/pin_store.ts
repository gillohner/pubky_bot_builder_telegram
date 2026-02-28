// src/core/scheduler/pin_store.ts
// Deno KV-backed pin tracking for periodic meetups messages.
// Follows the same KV pattern as ttl/store.ts (KV with in-memory fallback).

let kv: Deno.Kv | null = null;
const KV_UNAVAILABLE = typeof (Deno as unknown as { openKv?: unknown }).openKv !== "function";
const FALLBACK = new Map<string, number>();

async function getKv(): Promise<Deno.Kv> {
	if (KV_UNAVAILABLE) throw new Error("kv_unavailable");
	if (!kv) kv = await (Deno as unknown as { openKv: typeof Deno.openKv }).openKv("bot.sqlite");
	return kv;
}

function pinKey(chatId: string): Deno.KvKey {
	return ["periodic", "meetups", "pin", chatId];
}

function lastFiredKey(chatId: string): Deno.KvKey {
	return ["periodic", "meetups", "lastFired", chatId];
}

// ---------------------------------------------------------------------------
// Pin tracking
// ---------------------------------------------------------------------------

export async function savePinnedMessage(chatId: string, messageId: number): Promise<void> {
	if (!KV_UNAVAILABLE) {
		try {
			const store = await getKv();
			await store.set(pinKey(chatId), messageId);
			return;
		} catch {
			// fall through to memory
		}
	}
	FALLBACK.set(`pin:${chatId}`, messageId);
}

export async function getPinnedMessage(chatId: string): Promise<number | null> {
	if (!KV_UNAVAILABLE) {
		try {
			const store = await getKv();
			const res = await store.get<number>(pinKey(chatId));
			return res.value;
		} catch {
			// fall through to memory
		}
	}
	return FALLBACK.get(`pin:${chatId}`) ?? null;
}

export async function clearPinnedMessage(chatId: string): Promise<void> {
	if (!KV_UNAVAILABLE) {
		try {
			const store = await getKv();
			await store.delete(pinKey(chatId));
			return;
		} catch {
			// fall through to memory
		}
	}
	FALLBACK.delete(`pin:${chatId}`);
}

// ---------------------------------------------------------------------------
// Last-fired guard
// ---------------------------------------------------------------------------

export async function getLastFired(chatId: string): Promise<string | null> {
	if (!KV_UNAVAILABLE) {
		try {
			const store = await getKv();
			const res = await store.get<string>(lastFiredKey(chatId));
			return res.value;
		} catch {
			// fall through
		}
	}
	return (FALLBACK.get(`lf:${chatId}`) as unknown as string) ?? null;
}

export async function setLastFired(chatId: string, slot: string): Promise<void> {
	if (!KV_UNAVAILABLE) {
		try {
			const store = await getKv();
			await store.set(lastFiredKey(chatId), slot);
			return;
		} catch {
			// fall through
		}
	}
	// Store as number key but value is a string — abuse the Map slightly
	FALLBACK.set(`lf:${chatId}`, slot as unknown as number);
}
