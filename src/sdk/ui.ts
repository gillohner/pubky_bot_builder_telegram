// src/sdk/ui.ts
// Cross-platform UI abstractions for service responses

export interface UIButton {
	text: string;
	action: UIButtonAction;
	style?: "primary" | "secondary" | "danger";
	disabled?: boolean;
}

export type UIButtonAction =
	| { type: "callback"; data: string }
	| { type: "url"; url: string }
	| { type: "share"; text: string }
	| { type: "contact" }
	| { type: "location" };

export interface UIKeyboard {
	buttons: UIButton[][];
	inline?: boolean;
	oneTime?: boolean;
	resizeKeyboard?: boolean;
	placeholder?: string;
}

export interface UIMenu {
	title?: string;
	description?: string;
	buttons: UIButton[];
	columns?: number;
}

export interface UICard {
	title?: string;
	description?: string;
	image?: string;
	actions?: UIButton[];
}

export interface UICarousel {
	items: UICard[];
	navigation?: boolean;
}

export interface UIForm {
	title?: string;
	fields: UIFormField[];
	submitButton?: UIButton;
	cancelButton?: UIButton;
}

export interface UIFormField {
	id: string;
	label: string;
	type: "text" | "number" | "email" | "password" | "textarea" | "select" | "checkbox";
	required?: boolean;
	placeholder?: string;
	options?: { value: string; label: string }[];
	defaultValue?: string | number | boolean;
}

/**
 * Builder for creating cross-platform UI elements.
 */
export class UIBuilder {
	/**
	 * Create a keyboard with buttons arranged in rows.
	 */
	static keyboard(): KeyboardBuilder {
		return new KeyboardBuilder();
	}

	/**
	 * Create a menu with buttons arranged in a grid.
	 */
	static menu(title?: string): MenuBuilder {
		return new MenuBuilder(title);
	}

	/**
	 * Create a card with content and actions.
	 */
	static card(title?: string): CardBuilder {
		return new CardBuilder(title);
	}

	/**
	 * Create a carousel of cards.
	 */
	static carousel(): CarouselBuilder {
		return new CarouselBuilder();
	}

	/**
	 * Create a form for user input.
	 */
	static form(title?: string): FormBuilder {
		return new FormBuilder(title);
	}
}

export class KeyboardBuilder {
	private rows: UIButton[][] = [];
	private currentRow: UIButton[] = [];
	private opts: Partial<UIKeyboard> = {};

	/**
	 * Add a button to the current row.
	 */
	button(text: string, action: UIButtonAction, style?: UIButton["style"]): this {
		this.currentRow.push({ text, action, style });
		return this;
	}

	/**
	 * Add a callback button to the current row.
	 */
	callback(text: string, data: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "callback", data }, style);
	}

	/**
	 * Add a URL button to the current row.
	 */
	url(text: string, url: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "url", url }, style);
	}

	/**
	 * Start a new row of buttons.
	 */
	row(): this {
		if (this.currentRow.length > 0) {
			this.rows.push([...this.currentRow]);
			this.currentRow = [];
		}
		return this;
	}

	/**
	 * Set keyboard as inline (default for most platforms).
	 */
	inline(value = true): this {
		this.opts.inline = value;
		return this;
	}

	/**
	 * Set keyboard to resize automatically.
	 */
	resize(value = true): this {
		this.opts.resizeKeyboard = value;
		return this;
	}

	/**
	 * Set placeholder text for the keyboard.
	 */
	placeholder(text: string): this {
		this.opts.placeholder = text;
		return this;
	}

	/**
	 * Build the keyboard object.
	 */
	build(): UIKeyboard {
		// Add current row if it has buttons
		if (this.currentRow.length > 0) {
			this.rows.push([...this.currentRow]);
		}

		return {
			buttons: this.rows,
			inline: this.opts.inline ?? true,
			oneTime: this.opts.oneTime,
			resizeKeyboard: this.opts.resizeKeyboard,
			placeholder: this.opts.placeholder,
		};
	}
}

export class MenuBuilder {
	private buttons: UIButton[] = [];
	private title?: string;
	private desc?: string;
	private cols = 2;

	constructor(title?: string) {
		this.title = title;
	}

	/**
	 * Set menu description.
	 */
	description(text: string): this {
		this.desc = text;
		return this;
	}

	/**
	 * Set number of columns for button layout.
	 */
	columns(count: number): this {
		this.cols = Math.max(1, count);
		return this;
	}

	/**
	 * Add a button to the menu.
	 */
	button(text: string, action: UIButtonAction, style?: UIButton["style"]): this {
		this.buttons.push({ text, action, style });
		return this;
	}

	/**
	 * Add a callback button to the menu.
	 */
	callback(text: string, data: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "callback", data }, style);
	}

	/**
	 * Add a URL button to the menu.
	 */
	url(text: string, url: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "url", url }, style);
	}

	/**
	 * Build the menu object.
	 */
	build(): UIMenu {
		return {
			title: this.title,
			description: this.desc,
			buttons: this.buttons,
			columns: this.cols,
		};
	}
}

export class CardBuilder {
	private title?: string;
	private desc?: string;
	private image?: string;
	private actions: UIButton[] = [];

	constructor(title?: string) {
		this.title = title;
	}

	/**
	 * Set card description.
	 */
	description(text: string): this {
		this.desc = text;
		return this;
	}

	/**
	 * Set card image URL.
	 */
	imageUrl(url: string): this {
		this.image = url;
		return this;
	}

	/**
	 * Add an action button to the card.
	 */
	action(text: string, action: UIButtonAction, style?: UIButton["style"]): this {
		this.actions.push({ text, action, style });
		return this;
	}

	/**
	 * Add a callback action to the card.
	 */
	callback(text: string, data: string, style?: UIButton["style"]): this {
		return this.action(text, { type: "callback", data }, style);
	}

	/**
	 * Add a URL action to the card.
	 */
	url(text: string, url: string, style?: UIButton["style"]): this {
		return this.action(text, { type: "url", url }, style);
	}

	/**
	 * Build the card object.
	 */
	build(): UICard {
		return {
			title: this.title,
			description: this.desc,
			image: this.image,
			actions: this.actions.length > 0 ? this.actions : undefined,
		};
	}
}

export class CarouselBuilder {
	private items: UICard[] = [];
	private nav = false;

	/**
	 * Add a card to the carousel.
	 */
	card(card: UICard): this {
		this.items.push(card);
		return this;
	}

	/**
	 * Enable navigation controls.
	 */
	navigation(enabled = true): this {
		this.nav = enabled;
		return this;
	}

	/**
	 * Build the carousel object.
	 */
	build(): UICarousel {
		return {
			items: this.items,
			navigation: this.nav,
		};
	}
}

export class FormBuilder {
	private title?: string;
	private fields: UIFormField[] = [];
	private submitBtn?: UIButton;
	private cancelBtn?: UIButton;

	constructor(title?: string) {
		this.title = title;
	}

	/**
	 * Add a text field to the form.
	 */
	text(
		id: string,
		label: string,
		opts?: { required?: boolean; placeholder?: string; defaultValue?: string },
	): this {
		this.fields.push({
			id,
			label,
			type: "text",
			required: opts?.required,
			placeholder: opts?.placeholder,
			defaultValue: opts?.defaultValue,
		});
		return this;
	}

	/**
	 * Add a number field to the form.
	 */
	number(
		id: string,
		label: string,
		opts?: { required?: boolean; placeholder?: string; defaultValue?: number },
	): this {
		this.fields.push({
			id,
			label,
			type: "number",
			required: opts?.required,
			placeholder: opts?.placeholder,
			defaultValue: opts?.defaultValue,
		});
		return this;
	}

	/**
	 * Add a select field to the form.
	 */
	select(
		id: string,
		label: string,
		options: { value: string; label: string }[],
		opts?: { required?: boolean; defaultValue?: string },
	): this {
		this.fields.push({
			id,
			label,
			type: "select",
			options,
			required: opts?.required,
			defaultValue: opts?.defaultValue,
		});
		return this;
	}

	/**
	 * Set submit button.
	 */
	submit(text: string, data: string): this {
		this.submitBtn = { text, action: { type: "callback", data } };
		return this;
	}

	/**
	 * Set cancel button.
	 */
	cancel(text: string, data: string): this {
		this.cancelBtn = { text, action: { type: "callback", data } };
		return this;
	}

	/**
	 * Build the form object.
	 */
	build(): UIForm {
		return {
			title: this.title,
			fields: this.fields,
			submitButton: this.submitBtn,
			cancelButton: this.cancelBtn,
		};
	}
}
