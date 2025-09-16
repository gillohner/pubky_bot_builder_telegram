// example_services/links/service.ts
import {
	defineService,
	deleteResp,
	edit,
	inlineKeyboard,
	none,
	reply,
	runService,
} from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "@sdk/mod.ts";
import {
	LINK_CATEGORIES,
	LINKS_COMMAND,
	LINKS_SERVICE_ID,
	LINKS_VERSION,
	renderCategory,
} from "./constants.ts";

function buildCategoryKeyboard() {
	const keyboard = inlineKeyboard();

	// Add category buttons
	for (const [idx, category] of LINK_CATEGORIES.entries()) {
		keyboard.button({ text: category.name, data: `svc:${LINKS_SERVICE_ID}|c:${idx}` });
		keyboard.row();
	}

	// Add close button
	keyboard.button({ text: "✖ Close", data: `svc:${LINKS_SERVICE_ID}|cancel` });

	return keyboard.build();
}

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
			if (data === "cancel") return deleteResp();
			const match = /^c:(\d+)/.exec(data);
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
