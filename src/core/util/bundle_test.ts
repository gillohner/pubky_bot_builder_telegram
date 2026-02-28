// bundle_test.ts - regression tests for service bundler
import { assert, assertStringIncludes } from "jsr:@std/assert@1";
import { bundleService } from "./bundle.ts";

// Use one real service (simple-response) which imports @sdk/mod.ts implicitly
const SERVICE_PATH = "./packages/core_services/simple-response/service.ts";

Deno.test("bundleService() inlines sdk markers", async () => {
	const { code, entry, hasNpm } = await bundleService(SERVICE_PATH);
	// Bundler now writes to temp files instead of data URLs
	assert(entry.includes("/tmp") || entry.startsWith("/"), "entry should be a temp file path");
	assert(!hasNpm, "simple-response service should not use npm packages");
	// Heuristic: some known symbol from SDK appears (defineService or runService)
	assertStringIncludes(code, "defineService");
});
