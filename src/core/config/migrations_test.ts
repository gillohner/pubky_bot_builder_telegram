// tests for migration framework
import { DB } from "sqlite";
import { migrations, runMigrations } from "@core/config/migrations.ts";

function hasEnvPermission(): boolean {
	// Attempt a harmless env get inside try/catch to detect permission.
	try {
		Deno.env.get("_TEST_PROBE");
		return true;
	} catch {
		return false;
	}
}

Deno.test("migrations apply baseline once", () => {
	// use in-memory DB
	const db = new DB(":memory:");
	runMigrations(db);
	const rows = [
		...db.query<[number, string, number]>(
			`SELECT id, name, applied_at FROM migrations ORDER BY id ASC`,
		),
	];
	if (rows.length !== migrations.length) {
		throw new Error(`Expected ${migrations.length} migrations, got ${rows.length}`);
	}
	// re-run should not duplicate
	runMigrations(db);
	const rows2 = [...db.query<[number]>(`SELECT id FROM migrations`)];
	if (rows2.length !== rows.length) throw new Error("Migrations reapplied unexpectedly");
	db.close();
});

Deno.test("initDb runs migrations", async () => {
	if (!hasEnvPermission()) return; // skip without env permission
	// Dynamic import to defer CONFIG env access until after permission check
	const store = await import("@core/config/store.ts");
	store.initDb(":memory:");
	store.closeDb();
});
