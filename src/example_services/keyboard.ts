// example_services/keyboard.ts (SDK version)
import { defineService, edit, none, reply, runService } from "@/sdk/runtime.ts";

interface ButtonDef {
	id: string;
	label: string;
	emoji?: string;
}
const BUTTONS: ButtonDef[] = [
	{ id: "one", label: "First", emoji: "1️⃣" },
	{ id: "two", label: "Second", emoji: "2️⃣" },
];

function keyboard() {
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
		command: () => reply("Tap a button:", { options: { reply_markup: keyboard() } }),
		callback: (ev) => {
			const m = /\|btn:([^|]+)/.exec(ev.data);
			const id = m ? m[1]! : "";
			return edit(render(id), { options: { reply_markup: keyboard() } });
		},
		message: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
