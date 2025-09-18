// /packages/demo_services/ui_demo/service.ts
import {
	createI18n,
	defineService,
	none,
	reply,
	runService,
	UIBuilder,
	uiCard,
	uiCarousel,
	uiKeyboard,
	uiMenu,
} from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "@sdk/mod.ts";

interface UIState {
	carouselIndex?: number;
}
interface CarouselItemAction {
	text?: string;
	data?: string;
}
interface CarouselItem {
	title?: string;
	description?: string;
	image?: string;
	action?: CarouselItemAction;
}

function getUIState(state: Record<string, unknown> | undefined): UIState {
	return (state as UIState) || {};
}

function serializeUIState(state: UIState): Record<string, unknown> {
	return state as Record<string, unknown>;
}
import { UI_DEMO_MESSAGES, UI_DEMO_VERSION } from "./constants.ts";
import { RouteMeta } from "@schema/routing.ts";

/**
 * Demonstrates cross-platform UI components.
 */
const service = defineService({
	version: UI_DEMO_VERSION,
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
	const t = createI18n(UI_DEMO_MESSAGES, ev.language);

	const mainMenu = UIBuilder.keyboard()
		.namespace(service.manifest.id)
		.callback("⌨️ Keyboard", "demo_keyboard")
		.row()
		.callback("📋 Menu", "demo_menu")
		.row()
		.callback("🃏 Card", "demo_card")
		.row()
		.callback("🎠 Carousel", "demo_carousel")
		.row()
		.build();

	return uiKeyboard(mainMenu, t("welcome"), { deleteTrigger: true, ttl: 0 });
}

/**
 * Handle callback events.
 */
function handleCallback(ev: CallbackEvent) {
	const t = createI18n(UI_DEMO_MESSAGES, ev.language);
	const state = getUIState(ev.state);

	switch (ev.data) {
		case "demo_keyboard":
			return showKeyboardDemo(t, ev.routeMeta as RouteMeta);

		case "demo_menu":
			return showMenuDemo(t);

		case "demo_card":
			return showCardDemo(t);

		case "demo_carousel":
			return showCarouselDemo(
				t,
				state,
				(ev as unknown as { datasets?: Record<string, unknown> }).datasets,
			);

		case "carousel_next":
			return handleCarouselNavigation(
				t,
				state,
				"next",
				(ev as unknown as { datasets?: Record<string, unknown> }).datasets,
			);

		case "carousel_prev":
			return handleCarouselNavigation(
				t,
				state,
				"prev",
				(ev as unknown as { datasets?: Record<string, unknown> }).datasets,
			);

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
function showKeyboardDemo(
	t: (key: string, params?: Record<string, unknown>) => string,
	routeMeta: RouteMeta,
) {
	// Fallback: if routeMeta missing or lacks id (e.g., unit test invoking handler directly), use current manifest id
	const effectiveId = routeMeta?.id || service.manifest.id;
	const keyboard = UIBuilder.keyboard()
		.namespace(effectiveId)
		.callback("🔴 Red ", "action_red", "danger")
		.callback("🟢 Green", "action_green", "primary")
		.row()
		.callback("🔵 Blue", "action_blue", "secondary")
		.callback("🟡 Yellow", "action_yellow")
		.row()
		.url("🌐 Visit Website", "https://example.com")
		.row()
		.callback("🔙 Back", "back_to_main")
		.build();

	return uiKeyboard(keyboard, t("keyboard"));
}

/**
 * Show menu demo.
 */
function showMenuDemo(t: (key: string, params?: Record<string, unknown>) => string) {
	const menu = UIBuilder.menu("Options Menu")
		.namespace(service.manifest.id)
		.description("Choose from these options")
		.columns(3)
		.callback("📱 App", "action_app")
		.callback("🎮 Game", "action_game")
		.callback("🎵 Music", "action_music")
		.callback("📺 Video", "action_video")
		.callback("📚 Book", "action_book")
		.callback("🍕 Food", "action_food")
		.callback("🔙 Back", "back_to_main")
		.build();

	return uiMenu(menu, t("menu"));
}

/**
 * Show card demo.
 */
function showCardDemo(t: (key: string, params?: Record<string, unknown>) => string) {
	const card = UIBuilder.card("Sample Card")
		.namespace(service.manifest.id)
		.description("This is a demo card with actions and an image.")
		.imageUrl("https://picsum.photos/300/200")
		.callback("❤️ Like", "action_like", "primary")
		.callback("💬 Comment", "action_comment")
		.url("🔗 Share", "https://example.com/share")
		.callback("🔙 Back", "back_to_main")
		.build();

	return uiCard(card, t("card"));
}

/**
 * Show carousel demo.
 */
function showCarouselDemo(
	t: (key: string, params?: Record<string, unknown>) => string,
	state: UIState = {},
	datasets?: Record<string, unknown>,
) {
	const carouselData = (datasets?.carousel as { items?: CarouselItem[] } | undefined)?.items || [];
	const cards = carouselData.map((item) => {
		const builder = UIBuilder.card(String(item.title || "Item"))
			.namespace(service.manifest.id)
			.description(String(item.description || ""));
		if (item.image) builder.imageUrl(String(item.image));
		if (item.action && typeof item.action === "object") {
			builder.callback(String(item.action.text || "Action"), String(item.action.data || "noop"));
		}
		return builder.build();
	});
	if (cards.length === 0) {
		cards.push(
			UIBuilder.card("No Items")
				.namespace(service.manifest.id)
				.description("Carousel dataset empty or missing.")
				.callback("Reload", "demo_carousel")
				.build(),
		);
	}

	const currentIndex = state.carouselIndex || 0;
	const totalItems = cards.length;

	// Add navigation buttons to the current card
	const currentCard = { ...cards[currentIndex] };
	const navigationActions: import("@sdk/mod.ts").UIButton[] = [];

	if (currentIndex > 0) {
		navigationActions.push({
			text: "◀️ Previous",
			action: { type: "callback", data: "carousel_prev" },
		});
	}

	if (currentIndex < totalItems - 1) {
		navigationActions.push({
			text: "▶️ Next",
			action: { type: "callback", data: "carousel_next" },
		});
	}

	navigationActions.push({
		text: "🔙 Back",
		action: { type: "callback", data: "back_to_main" },
	});

	currentCard.actions = [...(currentCard.actions || []), ...navigationActions];

	const carousel = UIBuilder.carousel()
		.namespace(service.manifest.id)
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
	datasets?: Record<string, unknown>,
) {
	const currentIndex = state.carouselIndex || 0;
	let newIndex: number;

	if (direction === "next") {
		newIndex = Math.min(currentIndex + 1, 2); // 3 items total (0-2)
	} else {
		newIndex = Math.max(currentIndex - 1, 0);
	}

	const newState: UIState = { ...state, carouselIndex: newIndex };

	const result = showCarouselDemo(t, newState, datasets);
	return {
		...result,
		state: { op: "replace" as const, value: serializeUIState(newState) },
	};
}

/**
 * Show form demo.
 */
if (import.meta.main) await runService(service);
