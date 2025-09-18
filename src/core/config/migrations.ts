// src/core/config/migrations.ts
// Simple SQLite migration framework: tracks applied migrations in migrations table.
// Each migration has an id (monotonic increasing integer) and up() function.
import { DB } from "sqlite";
import { log } from "@core/util/logger.ts";

export interface Migration {
	id: number; // increasing integer
	name: string; // descriptive label
	up: (db: DB) => void | Promise<void>;
}

// Register migrations here in ascending id order. Idempotency: each migration should be safe to run once only.
// Baseline migration (id 1) ensures required tables exist (mirrors existing init schema) so we can evolve forward.
export const migrations: Migration[] = [
	{
		id: 1,
		name: "baseline_schema",
		up: (db: DB) => {
			db.execute(`CREATE TABLE IF NOT EXISTS chat_configs (
            chat_id TEXT PRIMARY KEY,
            config_id TEXT NOT NULL,
            config_json TEXT NOT NULL,
            config_hash TEXT,
            updated_at INTEGER NOT NULL
        );`);
			db.execute(`CREATE TABLE IF NOT EXISTS snapshots (
            chat_id TEXT PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            built_at INTEGER NOT NULL,
            integrity_hash TEXT NOT NULL
        );`);
			db.execute(`CREATE TABLE IF NOT EXISTS snapshots_by_config (
            config_hash TEXT PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            built_at INTEGER NOT NULL,
            integrity_hash TEXT NOT NULL
        );`);
			db.execute(`CREATE TABLE IF NOT EXISTS service_bundles (
            bundle_hash TEXT PRIMARY KEY,
            data_url TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );`);
		},
	},
	{
		id: 2,
		name: "drop_chat_snapshots_table",
		up: (db: DB) => {
			// If table exists, drop it. Safe because we are deprecating per-chat snapshots.
			try {
				db.execute(`DROP TABLE IF EXISTS snapshots;`);
			} catch (_err) {
				// ignore
			}
		},
	},
];

export function runMigrations(db: DB): void {
	db.execute(`CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
    );`);
	const appliedRows = db.query<[number]>(`SELECT id FROM migrations ORDER BY id ASC`);
	const applied = new Set(appliedRows.map((r) => r[0]));
	for (const m of migrations) {
		if (applied.has(m.id)) continue;
		const start = Date.now();
		try {
			m.up(db);
			db.query(`INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)`, [
				m.id,
				m.name,
				Date.now(),
			]);
			log.info("migration.applied", { id: m.id, name: m.name, ms: Date.now() - start });
		} catch (err) {
			log.error("migration.failed", { id: m.id, name: m.name, error: (err as Error).message });
			throw err; // stop further migrations
		}
	}
}
