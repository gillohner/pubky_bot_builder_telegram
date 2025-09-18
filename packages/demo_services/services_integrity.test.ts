// services_integrity.test.ts
// Verifies each service folder exports a default DefinedService with consistent manifest fields.
import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";

// Dynamically import each service's service.ts to avoid pulling extra indices.
const servicePaths = [
	"./hello/service.ts",
	"./survey/service.ts",
	"./links/service.ts",
	"./security_probe/service.ts",
	"./listener/service.ts",
	"./media_demo/service.ts",
	"./ui_demo/service.ts",
];

interface ManifestLike {
	id: string;
	version: string;
	kind: string;
	schemaVersion: number;
	command?: string;
	description?: string;
}

for (const rel of servicePaths) {
	Deno.test(`service manifest integrity: ${rel}`, async () => {
		const mod = await import(rel);
		const svc = mod.default;
		assert(svc, "default export missing");
		assert(svc.manifest, "manifest missing");
		const m = svc.manifest as ManifestLike;
		assert(typeof m.id === "string" && m.id.length > 0, "id invalid");
		assert(/\d+\.\d+\.\d+/.test(m.version), "version not semver-like");
		assert(["single_command", "command_flow", "listener"].includes(m.kind), "kind invalid");
		assertEquals(m.schemaVersion, 1, "schemaVersion mismatch");
		// command may still be an auto placeholder at define-time; allow __auto__/__runtime__ here
		if (m.kind !== "listener") {
			assert(
				typeof m.command === "string" && m.command.length > 0,
				"command placeholder missing",
			);
		}
	});
}
