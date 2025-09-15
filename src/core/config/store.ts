// src/core/config/store.ts
// Lightweight SQLite-backed storage for chat configs and persisted snapshots.
// Only used for config & snapshot persistence; flow state remains in-memory.

import { DB } from "sqlite";
import { RoutingSnapshot } from "@/types/routing.ts";
import { log } from "@core/util/logger.ts";

let db: DB | null = null;

export interface ChatConfigRecord {
	chat_id: string;
	config_id: string;
	config_json: string; // raw JSON string (Pubky config template)
	config_hash: string; // sha256 of canonical serialized config
	updated_at: number; // epoch ms
}

export interface SnapshotRecord {
	config_hash: string; // key now references config hash
	snapshot_json: string; // serialized RoutingSnapshot with integrity + sourceSig
	integrity_hash: string; // sha256 of snapshot_json
	updated_at: number;
}

export interface ServiceBundleRecord {
	bundle_hash: string; // sha256 of bundled code
	service_id: string;
	version: string;
	data_url: string; // data URL (sdk + service)
	updated_at: number;
}

// Initialize (idempotent). Caller responsible for calling once at startup.
export function initDb(path = Deno.env.get("LOCAL_DB_URL") || "./bot.sqlite"): void {
	if (db) return; // already initialized
	db = new DB(path);
	// Enable WAL for better concurrency (optional)
	try {
		// deno-lint-ignore no-explicit-any
		(db as any).execute?.("PRAGMA journal_mode=WAL;");
	} catch {
		/* ignore */
	}
	// Lightweight migration: ensure new columns exist if DB was created before upgrade
	try {
		// Attempt a harmless select to verify column; if it fails, we recreate table (simple path for prototype)
		for (const _ of db.query("SELECT config_hash FROM chat_configs LIMIT 1")) {
			void _; // no-op
		}
	} catch {
		// Older schema missing config_hash: rename, recreate, copy
		try {
			db.execute("ALTER TABLE chat_configs RENAME TO chat_configs_old;");
		} catch {
			/* ignore */
		}
		// Recreate fresh schema with config_hash
		db.execute(`CREATE TABLE IF NOT EXISTS chat_configs (
			chat_id TEXT PRIMARY KEY,
			config_id TEXT NOT NULL,
			config_json TEXT NOT NULL,
			config_hash TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);`);
		// Copy data: compute a fallback hash from config_id when missing
		try {
			for (
				const row of db.query(
					"SELECT chat_id, config_id, config_json, updated_at FROM chat_configs_old",
				)
			) {
				const chatId = row[0] as string;
				const configId = row[1] as string;
				const configJson = row[2] as string;
				const updatedAt = row[3] as number;
				// Simple hash (fnv1a) consistent with setChatConfig fallback
				let h = 0x811c9dc5;
				for (let i = 0; i < configId.length; i++) {
					h ^= configId.charCodeAt(i);
					h = Math.imul(h, 0x01000193);
				}
				const hashHex = (h >>> 0).toString(16).padStart(8, "0");
				db.query(
					`INSERT INTO chat_configs (chat_id, config_id, config_json, config_hash, updated_at)
					VALUES (?, ?, ?, ?, ?)`,
					[chatId, configId, configJson, hashHex, updatedAt],
				);
			}
			try {
				db.execute("DROP TABLE chat_configs_old;");
			} catch {
				/* ignore */
			}
			log.info("config.store.migrated.add_config_hash", {});
		} catch (err) {
			log.error("config.store.migration_failed", { error: (err as Error).message });
		}
	}
	db.execute(`CREATE TABLE IF NOT EXISTS chat_configs (
		chat_id TEXT PRIMARY KEY,
		config_id TEXT NOT NULL,
		config_json TEXT NOT NULL,
		config_hash TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);`);
	db.execute(`CREATE TABLE IF NOT EXISTS config_snapshots (
		config_hash TEXT PRIMARY KEY,
		snapshot_json TEXT NOT NULL,
		integrity_hash TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);`);
	db.execute(`CREATE TABLE IF NOT EXISTS service_bundles (
		bundle_hash TEXT PRIMARY KEY,
		service_id TEXT NOT NULL,
		version TEXT NOT NULL,
		data_url TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);`);
	db.execute(
		`CREATE INDEX IF NOT EXISTS idx_service_bundles_service ON service_bundles(service_id);`,
	);
	log.info("config.store.init", {});
}

function ensureDb(): DB {
	if (!db) throw new Error("Database not initialized. Call initDb() first.");
	return db;
}

export function setChatConfig(
	chatId: string,
	configId: string,
	config: unknown,
	configHash?: string,
): void {
	const d = ensureDb();
	const now = Date.now();
	const json = JSON.stringify(config);
	// Synchronous hash fallback: since Web Crypto digest is async, for now use a simple
	// ad-hoc hash (FNV-1a) if external caller did not provide a precomputed SHA-256.
	// We'll offer an async helper below for proper SHA-256 when building snapshots.
	function fnv1a(str: string): string {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16).padStart(8, "0");
	}
	const hash = configHash ?? fnv1a(json);
	d.query(
		`INSERT INTO chat_configs (chat_id, config_id, config_json, config_hash, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(chat_id) DO UPDATE SET config_id=excluded.config_id, config_json=excluded.config_json, config_hash=excluded.config_hash, updated_at=excluded.updated_at`,
		[chatId, configId, json, hash, now],
	);
	log.debug("config.store.set", { chatId, configId, hash });
}

export function getChatConfig(chatId: string): ChatConfigRecord | undefined {
	const d = ensureDb();
	for (
		const row of d.query(
			"SELECT chat_id, config_id, config_json, config_hash, updated_at FROM chat_configs WHERE chat_id=?",
			[chatId],
		)
	) {
		return {
			chat_id: row[0] as string,
			config_id: row[1] as string,
			config_json: row[2] as string,
			config_hash: row[3] as string,
			updated_at: row[4] as number,
		};
	}
	return undefined;
}

// Save snapshot by config hash; compute integrity hash first.
export function saveSnapshotByConfigHash(configHash: string, snapshot: RoutingSnapshot): void {
	const d = ensureDb();
	const now = Date.now();
	const json = JSON.stringify(snapshot);
	// Integrity uses same lightweight hash for now; snapshot builder can supply stronger hash.
	function fnv1a(str: string): string {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16).padStart(8, "0");
	}
	const integrity = fnv1a(json);
	d.query(
		`INSERT INTO config_snapshots (config_hash, snapshot_json, integrity_hash, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(config_hash) DO UPDATE SET snapshot_json=excluded.snapshot_json, integrity_hash=excluded.integrity_hash, updated_at=excluded.updated_at`,
		[configHash, json, integrity, now],
	);
	log.debug("config.store.snapshot.save", { configHash, integrity });
}

export function loadSnapshotByConfigHash(configHash: string): SnapshotRecord | undefined {
	const d = ensureDb();
	for (
		const row of d.query(
			"SELECT config_hash, snapshot_json, integrity_hash, updated_at FROM config_snapshots WHERE config_hash=?",
			[configHash],
		)
	) {
		return {
			config_hash: row[0] as string,
			snapshot_json: row[1] as string,
			integrity_hash: row[2] as string,
			updated_at: row[3] as number,
		};
	}
	return undefined;
}

export function deleteSnapshotByConfigHash(configHash: string): void {
	const d = ensureDb();
	d.query("DELETE FROM config_snapshots WHERE config_hash=?", [configHash]);
}

export function saveServiceBundle(rec: ServiceBundleRecord): void {
	const d = ensureDb();
	const now = Date.now();
	d.query(
		`INSERT INTO service_bundles (bundle_hash, service_id, version, data_url, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(bundle_hash) DO UPDATE SET service_id=excluded.service_id, version=excluded.version, data_url=excluded.data_url, updated_at=excluded.updated_at`,
		[rec.bundle_hash, rec.service_id, rec.version, rec.data_url, now],
	);
}

export function getServiceBundle(bundleHash: string): ServiceBundleRecord | undefined {
	const d = ensureDb();
	for (
		const row of d.query(
			"SELECT bundle_hash, service_id, version, data_url, updated_at FROM service_bundles WHERE bundle_hash=?",
			[bundleHash],
		)
	) {
		return {
			bundle_hash: row[0] as string,
			service_id: row[1] as string,
			version: row[2] as string,
			data_url: row[3] as string,
			updated_at: row[4] as number,
		};
	}
	return undefined;
}

// List all bundle hashes referenced by snapshots
export function listReferencedBundleHashes(): Set<string> {
	const d = ensureDb();
	const hashes = new Set<string>();
	for (const row of d.query("SELECT snapshot_json FROM config_snapshots")) {
		try {
			const snap = JSON.parse(row[0] as string) as {
				commands: Record<string, { bundleHash: string }>;
				listeners: { bundleHash: string }[];
			};
			Object.values(snap.commands).forEach((r) => hashes.add(r.bundleHash));
			snap.listeners.forEach((l) => hashes.add(l.bundleHash));
		} catch { /* ignore parse errors */ }
	}
	return hashes;
}

export function listAllBundleHashes(): string[] {
	const d = ensureDb();
	const out: string[] = [];
	for (const row of d.query("SELECT bundle_hash FROM service_bundles")) out.push(row[0] as string);
	return out;
}

export function deleteBundle(bundleHash: string): void {
	const d = ensureDb();
	d.query("DELETE FROM service_bundles WHERE bundle_hash=?", [bundleHash]);
}

// ---------------------------------------------------------------------------
// Backward compatibility wrappers (to be removed after test refactor)
// These maintain the previous API expected by existing code until all references
// are migrated to config-hash aware versions.
export function saveSnapshot(chatId: string, snapshot: RoutingSnapshot): void {
	const cfg = getChatConfig(chatId);
	const configId = cfg ? cfg.config_id : "default";
	function fnv1a(str: string): string {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16).padStart(8, "0");
	}
	const h = fnv1a(configId);
	if (!snapshot.configHash) (snapshot as RoutingSnapshot).configHash = h;
	saveSnapshotByConfigHash(h, snapshot);
}
export function loadSnapshot(chatId: string): { snapshot_json: string } | undefined {
	const cfg = getChatConfig(chatId);
	const configId = cfg ? cfg.config_id : "default";
	// Synchronous fallback: cannot await inside old signature; return undefined if not ready
	// For compatibility in tests, we compute a quick fnv hash identical to setChatConfig fallback.
	function fnv1a(str: string): string {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16).padStart(8, "0");
	}
	const h = fnv1a(configId);
	const rec = loadSnapshotByConfigHash(h);
	if (!rec) return undefined;
	return { snapshot_json: rec.snapshot_json };
}
export function deleteSnapshot(chatId: string): void {
	const cfg = getChatConfig(chatId);
	const configId = cfg ? cfg.config_id : "default";
	function fnv1a(str: string): string {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16).padStart(8, "0");
	}
	deleteSnapshotByConfigHash(fnv1a(configId));
}

export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}

// Async SHA-256 helper (canonical lowercase hex) for callers needing strong hash.
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
	const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
	// Cast to ArrayBuffer (Uint8Array.buffer is accepted by subtle.digest)
	const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
	const bytes = new Uint8Array(digest);
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return hex;
}
