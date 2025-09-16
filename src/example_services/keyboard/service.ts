import { defineService, edit, inlineKeyboard, none, reply, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "@sdk/mod.ts";
import {
	KEYBOARD_BUTTONS,
	KEYBOARD_COMMAND,
	KEYBOARD_SERVICE_ID,
	KEYBOARD_VERSION,
	renderSelection,
} from "./constants.ts";

function buildKeyboard() {
	const keyboard = inlineKeyboard();
	for (const btn of KEYBOARD_BUTTONS) {
		keyboard.button({
			text: `${btn.emoji ?? ""} ${btn.label}`.trim(),
			data: `svc:${KEYBOARD_SERVICE_ID}|btn:${btn.id}`,
		});
	}
	return keyboard.build();
}

const service = defineService({
	id: KEYBOARD_SERVICE_ID,
	version: KEYBOARD_VERSION,
	kind: "single_command",
	command: KEYBOARD_COMMAND,
	description: "Shows an inline keyboard and edits on selection",
	handlers: {
		command: (_ev: CommandEvent) => {
			return reply("Tap a button:", { options: { reply_markup: buildKeyboard() } });
		},
		callback: (ev: CallbackEvent) => {
			const m = /^btn:([^|]+)/.exec(ev.data);
			const id = m ? m[1] : "";
			return edit(renderSelection(id), { options: { reply_markup: buildKeyboard() } });
		},
		message: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
