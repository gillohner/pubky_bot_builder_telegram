// example_services/hello/service.ts (SDK module version)
// NOTE: Use relative path for sandbox bundler (data URL) to satisfy Deno's requirement
// for ./ or ../ prefixes. Aliased path caused failure inside data URL execution.
import { CommandEvent, defineService, none, reply, runService } from "../../pbb_sdk/mod.ts";

const service = defineService({
	id: "mock_hello",
	version: "1.0.0",
	kind: "single_command",
	command: "hello",
	description: "Responds with a greeting",
	handlers: {
		command: (ev: CommandEvent) => {
			const cfg = ev.serviceConfig || {};
			const greeting = typeof cfg.greeting === "string" ? cfg.greeting : "Hello from sandbox!";
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
