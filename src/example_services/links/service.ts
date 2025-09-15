// example_services/links/service.ts
import { defineService, deleteResp, edit, none, reply, runService } from "../../pbb_sdk/mod.ts";
import type { CallbackEvent, CommandEvent } from "../../pbb_sdk/mod.ts";

interface Category {
	name: string;
	links: { title: string; url: string }[];
}

const CATEGORIES: Category[] = [
	{
		name: "General",
		links: [{ title: "Pubky", url: "https://pubky.org" }, {
			title: "Docs",
			url: "https://docs.pubky.org",
		}],
	},
	{
		name: "Community",
		links: [{ title: "Dezentralschweiz", url: "https://dezentralschweiz.org" }],
	},
	{
		name: "Alt Frontends",
		links: [{ title: "Nitter", url: "https://nitter.net" }, {
			title: "ProxiTok",
			url: "https://proxitok.pabloferreiro.es",
		}],
	},
];

function catKeyboard(): Record<string, unknown> {
	const rows = CATEGORIES.map((
		c,
		idx,
	) => [{ text: c.name, callback_data: `svc:mock_links|c:${idx}` }]);
	rows.push([{ text: "✖ Close", callback_data: "svc:mock_links|cancel" }]);
	return { inline_keyboard: rows };
}
function renderCategory(idx: number): string {
	const cat = CATEGORIES[idx];
	if (!cat) return "Unknown category";
	return `*${cat.name}*\n` + cat.links.map((l) => `• [${l.title}](${l.url})`).join("\n");
}

const service = defineService({
	id: "mock_links",
	version: "1.0.0",
	kind: "single_command",
	command: "links",
	description: "Display categorized links with inline navigation",
	handlers: {
		command: (_ev: CommandEvent) =>
			reply("Select a category:", {
				options: { parse_mode: "Markdown", reply_markup: catKeyboard() },
			}),
		callback: (ev: CallbackEvent) => {
			const data = ev.data;
			if (data.endsWith("|cancel")) return deleteResp();
			const match = /\|c:(\d+)/.exec(data);
			const idx = match ? Number(match[1]) : -1;
			return edit(renderCategory(idx), {
				options: { parse_mode: "Markdown", reply_markup: catKeyboard() },
			});
		},
		message: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
