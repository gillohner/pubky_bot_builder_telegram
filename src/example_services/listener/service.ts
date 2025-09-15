// example_services/listener/service.ts
import { defineService, none, reply, runService } from "../../pbb_sdk/mod.ts";
import type { MessageEvent } from "../../pbb_sdk/mod.ts";

const service = defineService({
	id: "mock_listener",
	version: "1.0.0",
	kind: "listener",
	command: "listener",
	description: "Replies to any incoming message (listener)",
	handlers: {
		message: (_ev: MessageEvent) => reply("Listener saw a message"),
		command: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
