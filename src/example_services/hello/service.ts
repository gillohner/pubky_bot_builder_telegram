// example_services/hello/service.ts (SDK module version)
// NOTE: Use relative path for sandbox bundler (data URL) to satisfy Deno's requirement
// for ./ or ../ prefixes. Aliased path caused failure inside data URL execution.
import { CommandEvent, defineService, none, reply, runService } from "../../sdk/mod.ts";
import {
	HELLO_COMMAND,
	HELLO_DEFAULT_GREETING,
	HELLO_SERVICE_ID,
	HELLO_VERSION,
	HelloConfig,
} from "./constants.ts";

const service = defineService({
	id: HELLO_SERVICE_ID,
	version: HELLO_VERSION,
	kind: "single_command",
	command: HELLO_COMMAND,
	description: "Responds with a greeting",
	handlers: {
		command: (ev: CommandEvent) => {
			const cfg = (ev.serviceConfig || {}) as HelloConfig;
			const greeting = typeof cfg.greeting === "string" ? cfg.greeting : HELLO_DEFAULT_GREETING;
			return reply(greeting);
		},
		message: () => none(),
		callback: () => none(),
	},
});

export default service;

if (import.meta.main) {
	await runService(service);
}
