// /packages/demo_services/media_demo/service.ts
import {
	audio,
	contact,
	createI18n,
	defineService,
	document,
	location,
	none,
	reply,
	runService,
	UIBuilder,
	uiKeyboard,
	video,
} from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "@sdk/mod.ts";
import { MEDIA_DEMO_MESSAGES } from "./constants.ts";

/**
 * Demonstrates new media types and i18n functionality.
 */
// NOTE: id/command/description will be injected at runtime from routeMeta by the SDK runner.
const service = defineService({
	id: "__runtime__",
	command: "__runtime__",
	description: "__runtime__",
	version: "1.0.0",
	kind: "command_flow",
	handlers: {
		command: handleCommand,
		callback: handleCallback,
		message: () => none(),
	},
});

export default service;

/**
 * Handle command events.
 */
function handleCommand(ev: CommandEvent) {
	const t = createI18n(MEDIA_DEMO_MESSAGES, ev.language);

	// Build keyboard using cross-platform UIBuilder for consistency with UI demo
	const mainMenu = UIBuilder.keyboard()
		.namespace(service.manifest.id)
		.callback("🎵 Audio", "audio")
		.row()
		.callback("📹 Video", "video")
		.row()
		.callback("📄 Document", "document")
		.row()
		.callback("📍 Location", "location")
		.row()
		.callback("👤 Contact", "contact")
		.inline(false)
		.build();

	return uiKeyboard(mainMenu, t("welcome"));
}

/**
 * Handle callback events.
 */
function handleCallback(ev: CallbackEvent) {
	const t = createI18n(MEDIA_DEMO_MESSAGES, ev.language);

	switch (ev.data) {
		case "audio":
			return audio(
				"https://nexus.pubky.app/static/files/zmh3jeorngub6qjpbz5g9neggu8nh1cxby8xq456g6p8powbigey/0033M8ZE42M80/main",
				{
					title: "Bell Sound",
					performer: "Sound Effects",
					duration: 3,
					options: { caption: t("audio") },
					deleteTrigger: true,
				},
			);
		case "video":
			return video(
				"https://nexus.pubky.app/static/files/8fwmk5o1wfmn6whew47zoq31ka1mss15xnkcihattr5zbthp5nbo/0033WS5GHA710/main",
				{
					width: 360,
					height: 240,
					duration: 30,
					options: { caption: t("video") },
					deleteTrigger: true,
				},
			);
		case "document":
			return document("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", {
				filename: "sample.pdf",
				mimeType: "application/pdf",
				options: { caption: t("document") },
				deleteTrigger: true,
			});
		case "location":
			return location(40.7128, -74.0060, {
				title: "New York City",
				address: "NYC, NY, USA",
				options: { caption: t("location", { city: "New York" }) },
				deleteTrigger: true,
			});
		case "contact":
			return contact("+1234567890", "John", {
				lastName: "Doe",
				options: { caption: t("contact", { name: "John Doe" }) },
				deleteTrigger: true,
			});
		default:
			return reply(t("unknownType"));
	}
}

if (import.meta.main) await runService(service);
