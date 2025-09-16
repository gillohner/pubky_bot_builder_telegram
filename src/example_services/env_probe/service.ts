// example_services/env_probe/service.ts
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CommandEvent } from "@sdk/mod.ts";
import { ENV_PROBE_COMMAND, ENV_PROBE_SERVICE_ID, ENV_PROBE_VERSION } from "./constants.ts";

const service = defineService({
	id: ENV_PROBE_SERVICE_ID,
	version: ENV_PROBE_VERSION,
	kind: "single_command",
	command: ENV_PROBE_COMMAND,
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
