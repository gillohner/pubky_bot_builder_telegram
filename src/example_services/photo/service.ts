// example_services/photo/service.ts
import { defineService, none, photoResp, runService } from "@sdk/mod.ts";
import type { CommandEvent } from "@sdk/mod.ts";
import { PHOTO_COMMAND, PHOTO_SAMPLE_URL, PHOTO_SERVICE_ID, PHOTO_VERSION } from "./constants.ts";

const service = defineService({
	id: PHOTO_SERVICE_ID,
	version: PHOTO_VERSION,
	kind: "single_command",
	command: PHOTO_COMMAND,
	description: "Sends a sample photo",
	handlers: {
		command: (_ev: CommandEvent) => photoResp(PHOTO_SAMPLE_URL, { caption: "Here is a kitten!" }),
		message: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
