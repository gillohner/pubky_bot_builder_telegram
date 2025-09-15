// example_services/keyboard/service.ts
import { defineService, edit, none, reply, runService } from "../../sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "../../sdk/mod.ts";
import {
	buildKeyboardMarkup,
	KEYBOARD_COMMAND,
	KEYBOARD_SERVICE_ID,
	KEYBOARD_VERSION,
	renderSelection,
} from "./constants.ts";

const service = defineService({
	id: KEYBOARD_SERVICE_ID,
	version: KEYBOARD_VERSION,
	kind: "single_command",
	command: KEYBOARD_COMMAND,
	description: "Shows an inline keyboard and edits on selection",
	handlers: {
		command: (_ev: CommandEvent) =>
			reply("Tap a button:", { options: { reply_markup: buildKeyboardMarkup() } }),
		callback: (ev: CallbackEvent) => {
			const m = /\|btn:([^|]+)/.exec(ev.data);
			const id = m ? m[1] : "";
			return edit(renderSelection(id), { options: { reply_markup: buildKeyboardMarkup() } });
		},
		message: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
