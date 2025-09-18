// src/core/ttl/store.ts
// TTL tracking (restart-safe only when Deno KV available). If KV is not available
// we fall back to an in-memory map (non-persistent) per original design.

interface TrackedMessage {
	platform: string; // e.g. "telegram"
	chatId: string | number;
	messageId: number;
	deleteAt: number; // epoch ms
}

// KV keys layout:
// ["ttl","msg", platform, chatId, messageId] -> TrackedMessage
// ["ttl","byExp", deleteAt, platform, chatId, messageId] -> 1 (index for range scan by time)

let kv: Deno.Kv | null = null;
const KV_UNAVAILABLE = typeof (Deno as unknown as { openKv?: unknown }).openKv !== "function";
// Non-persistent fallback
const FALLBACK_PRIMARY = new Map<string, TrackedMessage>();
const FALLBACK_INDEX = new Map<string, 1>();

async function getKv(): Promise<Deno.Kv> {
	if (KV_UNAVAILABLE) throw new Error("kv_unavailable");
	if (!kv) kv = await (Deno as unknown as { openKv: typeof Deno.openKv }).openKv("bot.sqlite");
	return kv;
}

export interface TrackParams {
	platform: string;
	chatId: string | number;
	messageId: number;
	ttlSeconds: number; // >0
	now?: number;
}

export async function trackMessage(p: TrackParams): Promise<void> {
	if (p.ttlSeconds <= 0) return;
	const now = p.now ?? Date.now();
	const deleteAt = now + p.ttlSeconds * 1000;
	const rec: TrackedMessage = {
		platform: p.platform,
		chatId: p.chatId,
		messageId: p.messageId,
		deleteAt,
	};
	if (!KV_UNAVAILABLE) {
		try {
			const kv = await getKv();
			const k = ["ttl", "msg", rec.platform, rec.chatId, rec.messageId];
			const ki = ["ttl", "byExp", rec.deleteAt, rec.platform, rec.chatId, rec.messageId];
			await kv.atomic().set(k, rec).set(ki, 1).commit();
			return;
		} catch (_e) {
			// fall through to memory
		}
	}
	const pk = `${rec.platform}|${rec.chatId}|${rec.messageId}`;
	FALLBACK_PRIMARY.set(pk, rec);
	FALLBACK_INDEX.set(`${rec.deleteAt}|${pk}`, 1);
}

export interface ExpiredMessageHandler {
	(msg: TrackedMessage): Promise<void> | void;
}

// Remove all messages regardless of expiration (used at startup to ensure no stale leftovers)
export async function cleanupAll(handler: ExpiredMessageHandler): Promise<number> {
	if (!KV_UNAVAILABLE && kv) {
		let count = 0;
		for await (const entry of kv.list<TrackedMessage>({ prefix: ["ttl", "msg"] })) {
			try {
				await handler(entry.value);
			} catch (_err) { /* ignore */ }
			const rec = entry.value;
			await kv.atomic().delete(entry.key).delete([
				"ttl",
				"byExp",
				rec.deleteAt,
				rec.platform,
				rec.chatId,
				rec.messageId,
			]).commit();
			count++;
		}
		return count;
	}
	let removed = 0;
	for (const [k, rec] of FALLBACK_PRIMARY.entries()) {
		try {
			await handler(rec);
		} catch (_) { /* ignore */ }
		FALLBACK_PRIMARY.delete(k);
		removed++;
	}
	FALLBACK_INDEX.clear();
	return removed;
}

// Remove only expired messages (deleteAt <= now)
export async function cleanupExpired(
	handler: ExpiredMessageHandler,
	now = Date.now(),
): Promise<number> {
	if (!KV_UNAVAILABLE && kv) {
		let removed = 0;
		const upper: Deno.KvKey = ["ttl", "byExp", now + 1];
		for await (const entry of kv.list<unknown>({ prefix: ["ttl", "byExp"], end: upper })) {
			const [, , _deleteAt, platform, chatId, messageId] = entry.key as [
				string,
				string,
				number,
				string,
				string | number,
				number,
			];
			const recKey: Deno.KvKey = ["ttl", "msg", platform, chatId, messageId];
			const recRes = await kv.get<TrackedMessage>(recKey);
			if (recRes.value) {
				try {
					await handler(recRes.value);
				} catch (_) { /* ignore */ }
				await kv.atomic().delete(recKey).delete(entry.key).commit();
				removed++;
			} else {
				await kv.delete(entry.key);
			}
		}
		return removed;
	}
	let removed = 0;
	for (const [idxKey] of FALLBACK_INDEX.entries()) {
		const [deleteAtStr, platform, chatId, messageId] = idxKey.split("|");
		const deleteAt = Number(deleteAtStr);
		if (deleteAt <= now) {
			const pk = `${platform}|${chatId}|${messageId}`;
			const rec = FALLBACK_PRIMARY.get(pk);
			if (rec) {
				try {
					await handler(rec);
				} catch (_) { /* ignore */ }
				FALLBACK_PRIMARY.delete(pk);
				removed++;
			}
			FALLBACK_INDEX.delete(idxKey);
		}
	}
	return removed;
}

export function _closeKv() {
	if (kv) {
		try {
			kv.close();
		} catch (_) { /* ignore */ }
		kv = null;
	}
	FALLBACK_PRIMARY.clear();
	FALLBACK_INDEX.clear();
}
