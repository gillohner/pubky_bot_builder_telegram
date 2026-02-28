// datasets_test.ts - tests for dataset presence via snapshot
import { assert } from "jsr:@std/assert@1";
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { initDb } from "@core/config/store.ts";

Deno.test("snapshot builds with dataset schemas on services", async () => {
	Deno.env.set("LOCAL_DB_URL", ":memory:");
	initDb();
	const snap = await buildSnapshot("chat_ds_1", { force: true });
	// The links service uses datasets (categories) — verify snapshot builds
	const linksRoute = snap.commands["links"];
	assert(linksRoute, "links route present");
	assert(linksRoute.bundleHash, "links route has bundleHash");
});

Deno.test("snapshot build does not crash for unknown template", async () => {
	initDb();
	// buildSnapshot for a chat with no config falls back to default template
	try {
		await buildSnapshot("chat_ds_bad", { force: true });
	} catch (e) {
		throw new Error("Snapshot build should not throw: " + (e as Error).message);
	}
});
