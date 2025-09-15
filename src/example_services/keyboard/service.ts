// example_services/keyboard/service.ts
import { defineService, edit, none, reply, runService } from "../../pbb_sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "../../pbb_sdk/mod.ts";

interface ButtonDef {
	id: string;
	label: string;
	emoji?: string;
}
const BUTTONS: ButtonDef[] = [
	{ id: "one", label: "First", emoji: "1️⃣" },
	{ id: "two", label: "Second", emoji: "2️⃣" },
];

function keyboardMarkup(): Record<string, unknown> {
	return {
		inline_keyboard: [
			BUTTONS.map((b) => ({
				text: `${b.emoji ?? ""} ${b.label}`.trim(),
				callback_data: `svc:mock_keyboard|btn:${b.id}`,
			})),
		],
	};
}

function render(id: string): string {
	const btn = BUTTONS.find((b) => b.id === id);
	return btn ? `You picked: ${btn.label}` : "Unknown selection";
}

const service = defineService({
	id: "mock_keyboard",
	version: "1.0.0",
	kind: "single_command",
	command: "keyboard",
	description: "Shows an inline keyboard and edits on selection",
	handlers: {
		command: (_ev: CommandEvent) =>
			reply("Tap a button:", { options: { reply_markup: keyboardMarkup() } }),
		callback: (ev: CallbackEvent) => {
			const m = /\|btn:([^|]+)/.exec(ev.data);
			const id = m ? m[1] : "";
			return edit(render(id), { options: { reply_markup: keyboardMarkup() } });
		},
		message: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
