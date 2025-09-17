import { defineService, none, runService } from "@sdk/mod.ts";
import { BAD_DATASET_COMMAND, BAD_DATASET_SERVICE_ID, BAD_DATASET_VERSION } from "./constants.ts";

const service = defineService({
	id: BAD_DATASET_SERVICE_ID,
	version: BAD_DATASET_VERSION,
	kind: "single_command",
	command: BAD_DATASET_COMMAND,
	description: "Service with broken dataset json to test resilience",
	handlers: {
		command: () => none(),
		callback: () => none(),
		message: () => none(),
	},
});
export default service;
if (import.meta.main) await runService(service);
