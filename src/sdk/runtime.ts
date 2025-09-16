// sdk/runtime.ts (minimalist re-export facade for backward path compatibility)
export * from "./service.ts";
export * from "./state.ts";
export * from "./events.ts";
export * from "./responses/types.ts";
export * from "./responses/factory.ts";
export * from "./responses/guards.ts";
export * from "./i18n.ts";
export { runService } from "./runner.ts";
export * from "./ui.ts";

// Inline keyboard builder for Telegram and compatible adapters
export interface InlineButton {
	text: string;
	data: string;
	hide?: boolean;
}

export interface InlineKeyboardRowBuilder {
	button(btn: InlineButton): InlineKeyboardRowBuilder;
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder;
	row(): InlineKeyboardRowBuilder;
	done(): InlineKeyboardBuilder;
	build(): Record<string, unknown>;
}

export class InlineKeyboardBuilder implements InlineKeyboardRowBuilder {
	private rows: { text: string; callback_data: string }[][] = [];
	private current: { text: string; callback_data: string }[] = [];

	button(btn: InlineButton): InlineKeyboardRowBuilder {
		if (!btn.hide) this.current.push({ text: btn.text, callback_data: btn.data });
		return this;
	}
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder {
		for (const b of btns) this.button(b);
		return this;
	}
	row(): InlineKeyboardRowBuilder {
		if (this.current.length) {
			this.rows.push(this.current);
			this.current = [];
		}
		return this;
	}
	done(): InlineKeyboardBuilder {
		if (this.current.length) this.row();
		return this;
	}
	build(): Record<string, unknown> {
		this.done();
		return { inline_keyboard: this.rows };
	}
}

export function inlineKeyboard(): InlineKeyboardBuilder {
	return new InlineKeyboardBuilder();
}

// Simple i18n helper for services
export interface I18nMessages {
	[key: string]: string | I18nMessages;
}

export function createI18n(messages: I18nMessages, fallbackLang = "en") {
	return function t(key: string, params?: Record<string, unknown>, lang = fallbackLang): string {
		const keys = key.split(".");
		let current: string | I18nMessages = messages[lang] || messages[fallbackLang] || messages;

		for (const k of keys) {
			if (current && typeof current === "object" && k in current) {
				current = current[k];
			} else {
				return key; // Return key if translation not found
			}
		}

		if (typeof current !== "string") {
			return key;
		}

		// Simple parameter replacement
		if (params) {
			return current.replace(/\{\{(\w+)\}\}/g, (match, param) => {
				return params[param]?.toString() || match;
			});
		}

		return current;
	};
}
