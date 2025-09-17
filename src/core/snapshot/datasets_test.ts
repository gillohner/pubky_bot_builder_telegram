// datasets_test.ts - tests for dataset presence via snapshot
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { initDb } from "@core/config/store.ts";

Deno.test("snapshot assigns placeholder pubky dataset refs", async () => {
	Deno.env.set("LOCAL_DB_URL", ":memory:");
	initDb();
	const snap = await buildSnapshot("chat_ds_1", { force: true });
	const uiRoute = snap.commands["ui"];
	assert(uiRoute, "ui route present");
	assert(uiRoute.datasets, "datasets object present");
	assertEquals(typeof uiRoute.datasets?.carousel, "object");
	assertEquals(
		(uiRoute.datasets?.carousel as Record<string, unknown>).__pubkyRef !== undefined,
		true,
	);
});

Deno.test("broken local dataset JSON does not crash snapshot build", async () => {
	initDb();
	const _snap = await buildSnapshot("chat_ds_bad", { force: true });
	// switch to bad template explicitly
	try {
		await buildSnapshot("bad", { force: true });
	} catch (e) {
		throw new Error("Snapshot build should not throw for bad dataset: " + (e as Error).message);
	}
});
