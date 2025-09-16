// example_services/media_demo/service.ts
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
import {
	MEDIA_DEMO_COMMAND,
	MEDIA_DEMO_MESSAGES,
	MEDIA_DEMO_SERVICE_ID,
	MEDIA_DEMO_VERSION,
} from "./constants.ts";

/**
 * Demonstrates new media types and i18n functionality.
 */
const service = defineService({
	id: MEDIA_DEMO_SERVICE_ID,
	version: MEDIA_DEMO_VERSION,
	kind: "command_flow",
	command: MEDIA_DEMO_COMMAND,
	description: "Demo of new media types and i18n",
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
		.callback("🎵 Audio", "svc:mock_media|audio")
		.row()
		.callback("📹 Video", "svc:mock_media|video")
		.row()
		.callback("📄 Document", "svc:mock_media|document")
		.row()
		.callback("📍 Location", "svc:mock_media|location")
		.row()
		.callback("👤 Contact", "svc:mock_media|contact")
		.build();

	return uiKeyboard(mainMenu, t("welcome"));
}

/**
 * Handle callback events.
 */
function handleCallback(ev: CallbackEvent) {
	const t = createI18n(MEDIA_DEMO_MESSAGES, ev.language);

	// Dispatcher strips the `svc:mock_media|` prefix; we receive only the media type token.
	switch (ev.data) {
		case "audio":
			return audio(
				"https://nexus.pubky.app/static/files/zmh3jeorngub6qjpbz5g9neggu8nh1cxby8xq456g6p8powbigey/0033M8ZE42M80/main",
				{
					title: "Bell Sound",
					performer: "Sound Effects",
					duration: 3,
					options: { caption: t("audio") },
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
				},
			);
		case "document":
			return document("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", {
				filename: "sample.pdf",
				mimeType: "application/pdf",
				options: { caption: t("document") },
			});
		case "location":
			return location(40.7128, -74.0060, {
				title: "New York City",
				address: "NYC, NY, USA",
				options: { caption: t("location", { city: "New York" }) },
			});
		case "contact":
			return contact("+1234567890", "John", {
				lastName: "Doe",
				options: { caption: t("contact", { name: "John Doe" }) },
			});
		default:
			return reply(t("unknownType"));
	}
}

if (import.meta.main) await runService(service);
