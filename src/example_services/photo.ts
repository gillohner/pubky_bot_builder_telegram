// example_services/photo.ts (SDK version)
import { defineService, none, photoResp, runService } from "@/sdk/runtime.ts";

const service = defineService({
	id: "mock_photo",
	version: "1.0.0",
	kind: "single_command",
	command: "photo",
	description: "Sends a sample photo",
	handlers: {
		command: () =>
			photoResp(
				"https://nexus.pubky.app/static/files/c5nr657md9g8mut1xhjgf9h3cxaio3et9xyupo4fsgi5f7etocey/0033WXE37S700/feed",
				{ caption: "Here is a kitten!" },
			),
		message: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
