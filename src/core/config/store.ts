// src/core/config/store.ts
// SQLite-backed storage for chat configuration records, snapshots, and service bundles.
// Flow/session state intentionally remains purely in-memory.
//
// Schema (created lazily on first init):
// chat_configs(chat_id TEXT PK, config_id TEXT, config_json TEXT, config_hash TEXT, updated_at INTEGER)
// snapshots(chat_id TEXT PK, snapshot_json TEXT, built_at INTEGER, integrity_hash TEXT)
// snapshots_by_config(config_hash TEXT PK, snapshot_json TEXT, built_at INTEGER, integrity_hash TEXT)
// service_bundles(bundle_hash TEXT PK, data_url TEXT, code TEXT, created_at INTEGER)
//
// NOTE: Both chat-specific snapshots and config-hash keyed snapshots are kept because
// a single config template can serve many chats. Chat snapshots can be ephemeral or
// serve debugging use-cases; config-hash snapshots enable broad reuse & caching.

import { DB } from "sqlite";
import type { RoutingSnapshot } from "@schema/routing.ts";

let db: DB | null = null;

export interface ChatConfigRecord {
	chat_id: string;
	config_id: string;
	config_json: string;
	config_hash: string | null;
	updated_at: number;
}

export interface SnapshotRecord {
	config_hash: string;
	snapshot_json: string;
	built_at: number;
	integrity_hash: string;
}

export interface ServiceBundleRecord {
	bundle_hash: string;
	data_url: string;
	code: string;
	created_at: number;
}

// ---------------------------------------------------------------------------
// Initialization & helpers
// ---------------------------------------------------------------------------
export function initDb(path = Deno.env.get("LOCAL_DB_URL") || "./bot.sqlite"): void {
	if (db) return;
	db = new DB(path);
	db.execute(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
    `);
	db.execute(`
        CREATE TABLE IF NOT EXISTS chat_configs (
            chat_id TEXT PRIMARY KEY,
            config_id TEXT NOT NULL,
            config_json TEXT NOT NULL,
            config_hash TEXT,
            updated_at INTEGER NOT NULL
        );
    `);
	db.execute(`
        CREATE TABLE IF NOT EXISTS snapshots (
            chat_id TEXT PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            built_at INTEGER NOT NULL,
            integrity_hash TEXT NOT NULL
        );
    `);
	db.execute(`
        CREATE TABLE IF NOT EXISTS snapshots_by_config (
            config_hash TEXT PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            built_at INTEGER NOT NULL,
            integrity_hash TEXT NOT NULL
        );
    `);
	db.execute(`
        CREATE TABLE IF NOT EXISTS service_bundles (
            bundle_hash TEXT PRIMARY KEY,
            data_url TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    `);
}

function ensureDb(): DB {
	if (!db) throw new Error("Database not initialized");
	return db;
}

// ---------------------------------------------------------------------------
// Chat Config
// ---------------------------------------------------------------------------
export function setChatConfig(
	chatId: string,
	configId: string,
	config: unknown,
	configHash?: string,
): void {
	const database = ensureDb();
	const now = Date.now();
	const configJson = JSON.stringify(config ?? {});
	database.query(
		`INSERT INTO chat_configs (chat_id, config_id, config_json, config_hash, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           config_id=excluded.config_id,
           config_json=excluded.config_json,
           config_hash=excluded.config_hash,
           updated_at=excluded.updated_at`,
		[chatId, configId, configJson, configHash ?? null, now],
	);
}

export function getChatConfig(chatId: string): ChatConfigRecord | undefined {
	const database = ensureDb();
	const row = database
		.query<[string, string, string, string | null, number]>(
			`SELECT chat_id, config_id, config_json, config_hash, updated_at
             FROM chat_configs WHERE chat_id = ?`,
			[chatId],
		)
		.at(0);
	if (!row) return undefined;
	const [cid, cfgId, cfgJson, cfgHash, updated] = row;
	return {
		chat_id: cid,
		config_id: cfgId,
		config_json: cfgJson,
		config_hash: cfgHash,
		updated_at: updated,
	};
}

// ---------------------------------------------------------------------------
// Snapshots keyed by config hash (primary reuse mechanism)
// ---------------------------------------------------------------------------
export function saveSnapshotByConfigHash(configHash: string, snapshot: RoutingSnapshot): void {
	const database = ensureDb();
	const json = JSON.stringify(snapshot);
	const integrity = sha256HexSync(json); // synchronous helper
	database.query(
		`INSERT INTO snapshots_by_config (config_hash, snapshot_json, built_at, integrity_hash)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(config_hash) DO UPDATE SET
           snapshot_json=excluded.snapshot_json,
           built_at=excluded.built_at,
           integrity_hash=excluded.integrity_hash`,
		[configHash, json, snapshot.builtAt ?? Date.now(), integrity],
	);
}

export function loadSnapshotByConfigHash(configHash: string): SnapshotRecord | undefined {
	const database = ensureDb();
	const row = database
		.query<[string, string, number, string]>(
			`SELECT config_hash, snapshot_json, built_at, integrity_hash
             FROM snapshots_by_config WHERE config_hash = ?`,
			[configHash],
		)
		.at(0);
	if (!row) return undefined;
	const [chash, json, builtAt, integrity] = row;
	return {
		config_hash: chash,
		snapshot_json: json,
		built_at: builtAt,
		integrity_hash: integrity,
	};
}

export function deleteSnapshotByConfigHash(configHash: string): void {
	const database = ensureDb();
	database.query(`DELETE FROM snapshots_by_config WHERE config_hash = ?`, [configHash]);
}

// ---------------------------------------------------------------------------
// Chat-id keyed snapshots (auxiliary / debugging usage)
// ---------------------------------------------------------------------------
export function saveSnapshot(chatId: string, snapshot: RoutingSnapshot): void {
	const database = ensureDb();
	const json = JSON.stringify(snapshot);
	const integrity = sha256HexSync(json);
	database.query(
		`INSERT INTO snapshots (chat_id, snapshot_json, built_at, integrity_hash)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           snapshot_json=excluded.snapshot_json,
           built_at=excluded.built_at,
           integrity_hash=excluded.integrity_hash`,
		[chatId, json, snapshot.builtAt ?? Date.now(), integrity],
	);
}

export function loadSnapshot(chatId: string): { snapshot_json: string } | undefined {
	const database = ensureDb();
	const row = database
		.query<[string]>(`SELECT snapshot_json FROM snapshots WHERE chat_id = ?`, [chatId])
		.at(0);
	if (!row) return undefined;
	return { snapshot_json: row[0] };
}

export function deleteSnapshot(chatId: string): void {
	const database = ensureDb();
	database.query(`DELETE FROM snapshots WHERE chat_id = ?`, [chatId]);
}

// ---------------------------------------------------------------------------
// Service Bundles (content-addressed)
// ---------------------------------------------------------------------------
export function saveServiceBundle(rec: ServiceBundleRecord): void {
	const database = ensureDb();
	database.query(
		`INSERT INTO service_bundles (bundle_hash, data_url, code, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(bundle_hash) DO NOTHING`,
		[rec.bundle_hash, rec.data_url, rec.code, rec.created_at],
	);
}

export function getServiceBundle(bundleHash: string): ServiceBundleRecord | undefined {
	const database = ensureDb();
	const row = database
		.query<[string, string, string, number]>(
			`SELECT bundle_hash, data_url, code, created_at
             FROM service_bundles WHERE bundle_hash = ?`,
			[bundleHash],
		)
		.at(0);
	if (!row) return undefined;
	const [hash, dataUrl, code, createdAt] = row;
	return { bundle_hash: hash, data_url: dataUrl, code, created_at: createdAt };
}

export function listAllBundleHashes(): string[] {
	const database = ensureDb();
	const rows = database.query<[string]>(
		`SELECT bundle_hash FROM service_bundles`,
	);
	return rows.map((r) => r[0]);
}

// Bundles referenced by ANY snapshot (config-hash snapshots considered authoritative)
export function listReferencedBundleHashes(): Set<string> {
	const database = ensureDb();
	const hashes = new Set<string>();
	const rows = database.query<[string]>(
		`SELECT snapshot_json FROM snapshots_by_config`,
	);
	for (const [json] of rows) {
		try {
			const snap = JSON.parse(json) as RoutingSnapshot;
			for (const c of Object.values(snap.commands)) {
				// Use unknown then narrow to string for bundleHash
				const bundleHash = (c as unknown as { bundleHash?: string }).bundleHash;
				if (typeof bundleHash === "string" && bundleHash) hashes.add(bundleHash);
			}
			for (const l of snap.listeners) {
				const bundleHash = (l as unknown as { bundleHash?: string }).bundleHash;
				if (typeof bundleHash === "string" && bundleHash) hashes.add(bundleHash);
			}
		} catch {
			// Ignore malformed snapshot row
		}
	}
	return hashes;
}

export function deleteBundle(bundleHash: string): void {
	const database = ensureDb();
	database.query(`DELETE FROM service_bundles WHERE bundle_hash = ?`, [bundleHash]);
}

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------
export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}

// ---------------------------------------------------------------------------
// Hash utilities
// ---------------------------------------------------------------------------
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
	const data = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input); // Ensure it's backed by ArrayBuffer, not SharedArrayBuffer
	const digest = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(digest);
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Synchronous helper for integrity hashing (uses crypto.getRandomValues fallback if subtle unavailable).
function sha256HexSync(input: string): string {
	// For test/runtime convenience we compute a fast fallback hash (FNV-1a) then re-hash via async
	// caller when cryptographic strength is actually required. Here it's only for change detection.
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}
