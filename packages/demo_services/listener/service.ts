// /packages/demo_services/listener/service.ts
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { MessageEvent } from "@sdk/mod.ts";
import { LISTENER_COMMAND, LISTENER_SERVICE_ID, LISTENER_VERSION } from "./constants.ts";

const service = defineService({
	id: LISTENER_SERVICE_ID,
	version: LISTENER_VERSION,
	kind: "listener",
	command: LISTENER_COMMAND,
	description: "Replies to any incoming message (listener)",
	handlers: {
		message: (_ev: MessageEvent) => reply("Listener saw a message"),
		command: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
