// example_services/hello.ts (SDK version)
import { defineService, none, reply, runService } from "@/sdk/runtime.ts";

const service = defineService({
	id: "mock_hello",
	version: "1.0.0",
	kind: "single_command",
	command: "hello",
	description: "Responds with a greeting",
	handlers: {
		command: (ev) => {
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
