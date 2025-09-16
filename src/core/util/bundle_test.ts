// bundle_test.ts - regression tests for service bundler
import { assert, assertStringIncludes } from "jsr:@std/assert@1";
import { bundleService } from "./bundle.ts";

// Use one real example service (hello) which imports @sdk/mod.ts implicitly
const SERVICE_PATH = "./packages/demo_services/hello/service.ts";
// SDK runtime path no longer passed explicitly; bundler auto-detects SDK via imports.

Deno.test("bundleService() inlines sdk markers", async () => {
	const { code, dataUrl } = await bundleService(SERVICE_PATH);
	assert(dataUrl.startsWith("data:application/typescript;base64,"));
	// Heuristic: some known symbol from SDK appears (defineService or runService)
	assertStringIncludes(code, "defineService");
});
