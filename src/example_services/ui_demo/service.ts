// example_services/ui_demo/service.ts
import {
	createI18n,
	defineService,
	none,
	reply,
	runService,
	UIBuilder,
	uiCard,
	uiCarousel,
	uiForm,
	uiKeyboard,
	uiMenu,
} from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "@sdk/mod.ts";

interface UIState {
	carouselIndex?: number;
}

function getUIState(state: Record<string, unknown> | undefined): UIState {
	return (state as UIState) || {};
}

function serializeUIState(state: UIState): Record<string, unknown> {
	return state as Record<string, unknown>;
}
import {
	UI_DEMO_COMMAND,
	UI_DEMO_MESSAGES,
	UI_DEMO_SERVICE_ID,
	UI_DEMO_VERSION,
} from "./constants.ts";

/**
 * Demonstrates cross-platform UI components.
 */
const service = defineService({
	id: UI_DEMO_SERVICE_ID,
	version: UI_DEMO_VERSION,
	kind: "command_flow",
	command: UI_DEMO_COMMAND,
	description: "Demo of cross-platform UI components",
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
	const t = createI18n(UI_DEMO_MESSAGES, ev.language);

	const mainMenu = UIBuilder.keyboard()
		.callback("⌨️ Keyboard", "svc:mock_ui|demo_keyboard")
		.row()
		.callback("📋 Menu", "svc:mock_ui|demo_menu")
		.row()
		.callback("🃏 Card", "svc:mock_ui|demo_card")
		.row()
		.callback("🎠 Carousel", "svc:mock_ui|demo_carousel")
		.row()
		.callback("📝 Form", "svc:mock_ui|demo_form")
		.build();

	return uiKeyboard(mainMenu, t("welcome"));
}

/**
 * Handle callback events.
 */
function handleCallback(ev: CallbackEvent) {
	const t = createI18n(UI_DEMO_MESSAGES, ev.language);
	const state = getUIState(ev.state);

	switch (ev.data) {
		case "demo_keyboard":
			return showKeyboardDemo(t);

		case "demo_menu":
			return showMenuDemo(t);

		case "demo_card":
			return showCardDemo(t);

		case "demo_carousel":
			return showCarouselDemo(t, state);

		case "demo_form":
			return showFormDemo(t);

		case "carousel_next":
			return handleCarouselNavigation(t, state, "next");

		case "carousel_prev":
			return handleCarouselNavigation(t, state, "prev");

		case "action_submit":
			return handleFormSubmission(t);

		case "back_to_main": {
			// Create a command event from the callback event
			const commandEvent: CommandEvent = {
				type: "command",
				chatId: ev.chatId,
				userId: ev.userId,
				language: ev.language,
				serviceConfig: ev.serviceConfig,
				state: ev.state,
				stateVersion: ev.stateVersion,
				t: ev.t,
			};
			return handleCommand(commandEvent);
		}

		default:
			if (ev.data.startsWith("action_")) {
				const action = ev.data.replace("action_", "");
				return reply(t("buttonPressed", { button: action }) + "\n\n" + t("tryAgain"));
			}
			return reply(t("selectOption"));
	}
}

/**
 * Show keyboard demo.
 */
function showKeyboardDemo(t: (key: string, params?: Record<string, unknown>) => string) {
	const keyboard = UIBuilder.keyboard()
		.callback("🔴 Red", "svc:mock_ui|action_red", "danger")
		.callback("🟢 Green", "svc:mock_ui|action_green", "primary")
		.row()
		.callback("🔵 Blue", "svc:mock_ui|action_blue", "secondary")
		.callback("🟡 Yellow", "svc:mock_ui|action_yellow")
		.row()
		.url("🌐 Visit Website", "https://example.com")
		.row()
		.callback("🔙 Back", "svc:mock_ui|back_to_main")
		.build();

	return uiKeyboard(keyboard, t("keyboard"));
}

/**
 * Show menu demo.
 */
function showMenuDemo(t: (key: string, params?: Record<string, unknown>) => string) {
	const menu = UIBuilder.menu("Options Menu")
		.description("Choose from these options")
		.columns(3)
		.callback("📱 App", "svc:mock_ui|action_app")
		.callback("🎮 Game", "svc:mock_ui|action_game")
		.callback("🎵 Music", "svc:mock_ui|action_music")
		.callback("📺 Video", "svc:mock_ui|action_video")
		.callback("📚 Book", "svc:mock_ui|action_book")
		.callback("🍕 Food", "svc:mock_ui|action_food")
		.callback("🔙 Back", "svc:mock_ui|back_to_main")
		.build();

	return uiMenu(menu, t("menu"));
}

/**
 * Show card demo.
 */
function showCardDemo(t: (key: string, params?: Record<string, unknown>) => string) {
	const card = UIBuilder.card("Sample Card")
		.description("This is a demo card with actions and an image.")
		.imageUrl("https://picsum.photos/300/200")
		.callback("❤️ Like", "svc:mock_ui|action_like", "primary")
		.callback("💬 Comment", "svc:mock_ui|action_comment")
		.url("🔗 Share", "https://example.com/share")
		.callback("🔙 Back", "svc:mock_ui|back_to_main")
		.build();

	return uiCard(card, t("card"));
}

/**
 * Show carousel demo.
 */
function showCarouselDemo(
	t: (key: string, params?: Record<string, unknown>) => string,
	state: UIState = {},
) {
	const cards = [
		UIBuilder.card("First Item")
			.description("This is the first item in the carousel.")
			.imageUrl("https://picsum.photos/300/200?random=1")
			.callback("✨ Action 1", "svc:mock_ui|action_item1")
			.build(),

		UIBuilder.card("Second Item")
			.description("This is the second item in the carousel.")
			.imageUrl("https://picsum.photos/300/200?random=2")
			.callback("🎯 Action 2", "svc:mock_ui|action_item2")
			.build(),

		UIBuilder.card("Third Item")
			.description("This is the third item in the carousel.")
			.imageUrl("https://picsum.photos/300/200?random=3")
			.callback("🚀 Action 3", "svc:mock_ui|action_item3")
			.build(),
	];

	const currentIndex = state.carouselIndex || 0;
	const totalItems = cards.length;

	// Add navigation buttons to the current card
	const currentCard = { ...cards[currentIndex] };
	const navigationActions: import("@sdk/mod.ts").UIButton[] = [];

	if (currentIndex > 0) {
		navigationActions.push({
			text: "◀️ Previous",
			action: { type: "callback", data: "svc:mock_ui|carousel_prev" },
		});
	}

	if (currentIndex < totalItems - 1) {
		navigationActions.push({
			text: "▶️ Next",
			action: { type: "callback", data: "svc:mock_ui|carousel_next" },
		});
	}

	navigationActions.push({
		text: "🔙 Back",
		action: { type: "callback", data: "svc:mock_ui|back_to_main" },
	});

	currentCard.actions = [...(currentCard.actions || []), ...navigationActions];

	const carousel = UIBuilder.carousel()
		.card(currentCard)
		.build();

	return uiCarousel(carousel, `${t("carousel")} (${currentIndex + 1}/${totalItems})`);
}

/**
 * Handle carousel navigation.
 */
function handleCarouselNavigation(
	t: (key: string, params?: Record<string, unknown>) => string,
	state: UIState,
	direction: "next" | "prev",
) {
	const currentIndex = state.carouselIndex || 0;
	let newIndex: number;

	if (direction === "next") {
		newIndex = Math.min(currentIndex + 1, 2); // 3 items total (0-2)
	} else {
		newIndex = Math.max(currentIndex - 1, 0);
	}

	const newState: UIState = { ...state, carouselIndex: newIndex };

	const result = showCarouselDemo(t, newState);
	return {
		...result,
		state: { op: "replace" as const, value: serializeUIState(newState) },
	};
}

/**
 * Show form demo.
 */
function showFormDemo(t: (key: string, params?: Record<string, unknown>) => string) {
	const form = UIBuilder.form("Contact Form")
		.text("name", "Your Name", { required: true, placeholder: "Enter your name" })
		.text("email", "Email Address", { required: true, placeholder: "your@email.com" })
		.select("topic", "Topic", [
			{ value: "support", label: "Support" },
			{ value: "feedback", label: "Feedback" },
			{ value: "other", label: "Other" },
		], { required: true })
		.number("rating", "Rating (1-5)", { defaultValue: 5 })
		.submit("📤 Submit", "svc:mock_ui|action_submit")
		.cancel("❌ Cancel", "svc:mock_ui|back_to_main")
		.build();

	return uiForm(form, t("form"));
}

/**
 * Handle form submission.
 */
function handleFormSubmission(t: (key: string, params?: Record<string, unknown>) => string) {
	return reply(t("formSubmitted") + "\n\n" + t("tryAgain"));
}

if (import.meta.main) await runService(service);
