export const KEYBOARD_SERVICE_ID = "mock_keyboard" as const;
export const KEYBOARD_VERSION = "1.0.0" as const;
export const KEYBOARD_COMMAND = "keyboard" as const;

export interface KeyboardButtonDef {
	id: string;
	label: string;
	emoji?: string;
}

export const KEYBOARD_BUTTONS: KeyboardButtonDef[] = [
	{ id: "one", label: "First", emoji: "1️⃣" },
	{ id: "two", label: "Second", emoji: "2️⃣" },
];

export function buildKeyboardMarkup(): Record<string, unknown> {
	return {
		inline_keyboard: [
			KEYBOARD_BUTTONS.map((b) => ({
				text: `${b.emoji ?? ""} ${b.label}`.trim(),
				callback_data: `svc:${KEYBOARD_SERVICE_ID}|btn:${b.id}`,
			})),
		],
	};
}

export function renderSelection(id: string): string {
	const btn = KEYBOARD_BUTTONS.find((b) => b.id === id);
	return btn ? `You picked: ${btn.label}` : "Unknown selection";
}
