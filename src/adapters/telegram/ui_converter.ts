// src/adapters/telegram/ui_converter.ts
// Converts cross-platform UI elements to Telegram-specific format

import type { UIButton, UICard, UICarousel, UIKeyboard, UIMenu } from "@sdk/mod.ts";

// Type for Telegram inline keyboard button
type TelegramButton = { text: string; callback_data?: string; url?: string };

/**
 * Convert cross-platform UI button to Telegram inline keyboard button.
 */
export function convertButton(button: UIButton): TelegramButton {
	const result: TelegramButton = {
		text: button.text,
	};

	switch (button.action.type) {
		case "callback":
			result.callback_data = button.action.data;
			break;
		case "url":
			result.url = button.action.url;
			break;
		case "share":
			// For Telegram, share becomes a callback with special prefix
			result.callback_data = `share:${button.action.text}`;
			break;
		case "contact":
			// Contact request becomes a callback
			result.callback_data = "request_contact";
			break;
		case "location":
			// Location request becomes a callback
			result.callback_data = "request_location";
			break;
		default:
			// Fallback to callback
			result.callback_data = "unsupported_action";
			break;
	}

	return result;
}

/**
 * Convert cross-platform keyboard to Telegram inline keyboard.
 */
export function convertKeyboard(keyboard: UIKeyboard): { inline_keyboard: TelegramButton[][] } {
	const rows = keyboard.buttons.map((row) => row.map(convertButton));
	return { inline_keyboard: rows };
}

/**
 * Convert cross-platform menu to Telegram inline keyboard.
 */
export function convertMenu(menu: UIMenu): { inline_keyboard: TelegramButton[][] } {
	const { buttons, columns = 2 } = menu;
	const rows: TelegramButton[][] = [];

	for (let i = 0; i < buttons.length; i += columns) {
		const row = buttons.slice(i, i + columns).map(convertButton);
		rows.push(row);
	}

	return { inline_keyboard: rows };
}

/**
 * Convert cross-platform card to Telegram message with inline keyboard.
 */
export function convertCard(card: UICard): {
	text: string;
	reply_markup?: { inline_keyboard: TelegramButton[][] };
	photo?: string;
} {
	let text = "";

	if (card.title) {
		text += `**${card.title}**\n\n`;
	}

	if (card.description) {
		text += card.description;
	}

	const result: {
		text: string;
		reply_markup?: { inline_keyboard: TelegramButton[][] };
		photo?: string;
	} = { text: text.trim() || "Card" };

	if (card.image) {
		result.photo = card.image;
	}

	if (card.actions && card.actions.length > 0) {
		const buttons = card.actions.map(convertButton);
		result.reply_markup = { inline_keyboard: [buttons] };
	}

	return result;
}

/**
 * Convert cross-platform carousel to Telegram message.
 * Since Telegram doesn't have native carousel support, we'll show the first item.
 * Navigation should be handled by the service itself through proper callback buttons.
 */
export function convertCarousel(carousel: UICarousel): {
	text: string;
	reply_markup?: { inline_keyboard: TelegramButton[][] };
} {
	if (carousel.items.length === 0) {
		return { text: "Empty carousel" };
	}

	// Show the first item
	const firstItem = carousel.items[0];
	let text = "";

	if (carousel.items.length > 1) {
		text += `📋 **Carousel** (1 of ${carousel.items.length})\n\n`;
	}

	if (firstItem.title) {
		text += `**${firstItem.title}**\n\n`;
	}

	if (firstItem.description) {
		text += firstItem.description;
	}

	const buttons: TelegramButton[][] = [];

	// Add item actions if available
	if (firstItem.actions && firstItem.actions.length > 0) {
		const actionButtons = firstItem.actions.map(convertButton);
		buttons.push(actionButtons);
	}

	return {
		text: text.trim() || "Carousel",
		reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
	};
}
