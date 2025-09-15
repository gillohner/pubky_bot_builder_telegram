// example_services/env_probe/service.ts
import { defineService, none, reply, runService } from "../../pbb_sdk/mod.ts";
import type { CommandEvent } from "../../pbb_sdk/mod.ts";

const service = defineService({
	id: "mock_env_probe",
	version: "1.0.0",
	kind: "single_command",
	command: "env",
	description: "Probe env & fs (should be denied)",
	handlers: {
		command: async (_ev: CommandEvent) => {
			const diagnostics: string[] = [];
			try {
				diagnostics.push("ENV_BOT_TOKEN=" + (Deno.env.get("BOT_TOKEN") || "MISSING"));
			} catch {
				diagnostics.push("env_denied");
			}
			try {
				await Deno.readTextFile("README.md");
				diagnostics.push("read_ok");
			} catch {
				diagnostics.push("read_denied");
			}
			return reply("env probe: " + diagnostics.join(","));
		},
		message: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
