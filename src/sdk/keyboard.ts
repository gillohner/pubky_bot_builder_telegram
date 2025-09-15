// sdk/keyboard.ts

export interface InlineButton {
	text: string;
	data: string;
	hide?: boolean;
}

export interface InlineKeyboardRowBuilder {
	button(btn: InlineButton): InlineKeyboardRowBuilder;
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder;
	done(): InlineKeyboardBuilder;
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
