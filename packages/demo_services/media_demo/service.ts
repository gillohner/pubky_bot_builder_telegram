// /packages/demo_services/media_demo/service.ts
import {
	audio,
	contact,
	createI18n,
	defineService,
	document,
	edit,
	location,
	none,
	photo,
	reply,
	runService,
	UIBuilder,
	uiKeyboard,
	video,
} from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import { MEDIA_DEMO_MESSAGES, MEDIA_DEMO_VERSION } from "./constants.ts";

/**
 * Demonstrates new media types and i18n functionality.
 */
// NOTE: id/command/description will be injected at runtime from routeMeta by the SDK runner.
const service = defineService({
	version: MEDIA_DEMO_VERSION,
	kind: "command_flow",
	handlers: {
		command: handleCommand,
		callback: handleCallback,
		message: handleMessage,
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
		.row()
		.callback("🖼️ Gallery", "gallery")
		.inline(false)
		.build();

	return uiKeyboard(
		mainMenu,
		t("welcome"),
		{
			deleteTrigger: true,
			ttl: 5, // auto-delete after 5 seconds
		},
	);
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
					deleteTrigger: true, // user action (callback) triggers deletion of this message
					ttl: 5, // auto-delete after 5 seconds, defaults to env variable DEFAULT_MESSAGE_TTL if not set
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
					ttl: 0, // no auto-delete
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
		case "gallery":
			return showGallery(ev);
		default:
			// Check if it's a gallery navigation callback
			if (ev.data.startsWith("gallery:")) {
				return handleGalleryNavigation(ev);
			}
			return reply(t("unknownType"));
	}
}

/**
 * Handle message events (for URL input during gallery flow)
 */
function handleMessage(ev: MessageEvent) {
	// If we're in gallery flow and user sends a URL, try to display it
	if (ev.state && ev.state.flow === "gallery") {
		const message = ev.message as { text?: string };
		const text = message?.text?.trim();

		if (
			text &&
			(text.startsWith("http://") || text.startsWith("https://") || text.startsWith("pubky://"))
		) {
			return handleUrlInput(ev, text);
		}

		return reply(
			"Please send a valid URL (http://, https://, or pubky://) or use the gallery buttons.",
		);
	}

	return none();
}

/**
 * Show gallery with pubky:// data injection
 */
function showGallery(ev: CallbackEvent) {
	// Access the gallery dataset injected from service config
	const gallery = ev.datasets?.gallery as {
		images?: Array<{ url: string; caption?: string; title?: string }>;
	};

	if (!gallery?.images || gallery.images.length === 0) {
		return edit(
			"Gallery dataset not found or empty. Please configure the gallery dataset in your service config.",
			{
				deleteTrigger: true,
			},
		);
	}

	// Start with the first image
	const currentIndex = 0;
	const image = gallery.images[currentIndex];

	// Build navigation keyboard
	const navKeyboard = UIBuilder.keyboard()
		.namespace(service.manifest.id);

	if (gallery.images.length > 1) {
		navKeyboard
			.callback("⬅️ Previous", `gallery:prev:${currentIndex}`)
			.callback("➡️ Next", `gallery:next:${currentIndex}`)
			.row();
	}

	navKeyboard
		.callback("🔗 Custom URL", "gallery:custom")
		.callback("🔙 Back to Menu", "back")
		.inline(false);

	const keyboard = navKeyboard.build();

	// Determine the media URL (handle pubky:// URLs)
	const caption = `${image.title || "Gallery Image"}\\n${image.caption || ""}\\n\\n📍 ${
		currentIndex + 1
	} of ${gallery.images.length}`;

	return photo(image.url, {
		caption,
		options: {
			reply_markup: keyboard,
		},
		deleteTrigger: true,
		state: {
			op: "replace",
			value: { flow: "gallery", currentIndex },
		},
	});
}

/**
 * Handle gallery navigation
 */
function handleGalleryNavigation(ev: CallbackEvent) {
	const [, action, indexStr] = ev.data.split(":");
	const currentIndex = parseInt(indexStr || "0", 10);

	const gallery = ev.datasets?.gallery as {
		images?: Array<{ url: string; caption?: string; title?: string }>;
	};

	if (!gallery?.images || gallery.images.length === 0) {
		return edit("Gallery not available.", { deleteTrigger: true });
	}

	let newIndex = currentIndex;

	switch (action) {
		case "prev":
			newIndex = currentIndex > 0 ? currentIndex - 1 : gallery.images.length - 1;
			break;
		case "next":
			newIndex = currentIndex < gallery.images.length - 1 ? currentIndex + 1 : 0;
			break;
		case "custom":
			return edit("Send me a URL (http://, https://, or pubky://) to display:", {
				state: {
					op: "merge",
					value: { waitingForUrl: true },
				},
				deleteTrigger: true,
			});
		default:
			return none();
	}

	const image = gallery.images[newIndex];
	// Build navigation keyboard
	const navKeyboard = UIBuilder.keyboard()
		.namespace(service.manifest.id);

	if (gallery.images.length > 1) {
		navKeyboard
			.callback("⬅️ Previous", `gallery:prev:${newIndex}`)
			.callback("➡️ Next", `gallery:next:${newIndex}`)
			.row();
	}

	navKeyboard
		.callback("🔗 Custom URL", "gallery:custom")
		.callback("🔙 Back to Menu", "back")
		.inline(false);

	const keyboard = navKeyboard.build();

	const caption = `${image.title || "Gallery Image"}\n${image.caption || ""}\n\n📍 ${
		newIndex + 1
	} of ${gallery.images.length}`;

	return photo(image.url, {
		caption,
		options: {
			reply_markup: keyboard,
		},
		deleteTrigger: true,
		state: {
			op: "replace",
			value: { flow: "gallery", currentIndex: newIndex },
		},
	});
}

/**
 * Handle URL input from user
 */
function handleUrlInput(_ev: MessageEvent, url: string) {
	const backKeyboard = UIBuilder.keyboard()
		.namespace(service.manifest.id)
		.callback("🔙 Back to Gallery", "gallery")
		.callback("🏠 Main Menu", "back")
		.inline(false)
		.build();

	return photo(url, {
		caption: `Custom image from: ${url}`,
		options: {
			reply_markup: backKeyboard,
		},
		deleteTrigger: true,
		state: {
			op: "replace",
			value: { flow: "gallery" },
		},
	});
}

if (import.meta.main) await runService(service);
