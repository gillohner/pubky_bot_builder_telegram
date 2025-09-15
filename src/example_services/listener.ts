// example_services/listener.ts (SDK version)
import { defineService, none, reply, runService } from "@/sdk/runtime.ts";

const service = defineService({
	id: "mock_listener",
	version: "1.0.0",
	kind: "listener",
	command: "listener",
	description: "Replies to any incoming message (listener)",
	handlers: {
		message: () => reply("Listener saw a message"),
		command: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
