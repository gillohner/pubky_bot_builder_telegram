// example_services/links/service.ts
import { defineService, deleteResp, edit, none, reply, runService } from "../../sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "../../sdk/mod.ts";
import {
	buildCategoryKeyboard,
	LINKS_COMMAND,
	LINKS_SERVICE_ID,
	LINKS_VERSION,
	renderCategory,
} from "./constants.ts";

const service = defineService({
	id: LINKS_SERVICE_ID,
	version: LINKS_VERSION,
	kind: "single_command",
	command: LINKS_COMMAND,
	description: "Display categorized links with inline navigation",
	handlers: {
		command: (_ev: CommandEvent) =>
			reply("Select a category:", {
				options: { parse_mode: "Markdown", reply_markup: buildCategoryKeyboard() },
			}),
		callback: (ev: CallbackEvent) => {
			const data = ev.data;
			if (data.endsWith("|cancel")) return deleteResp();
			const match = /\|c:(\d+)/.exec(data);
			const idx = match ? Number(match[1]) : -1;
			return edit(renderCategory(idx), {
				options: { parse_mode: "Markdown", reply_markup: buildCategoryKeyboard() },
			});
		},
		message: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
