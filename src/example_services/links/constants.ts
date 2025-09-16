export const LINKS_SERVICE_ID = "mock_links" as const;
export const LINKS_VERSION = "1.0.0" as const;
export const LINKS_COMMAND = "links" as const;

export interface LinkCategory {
	name: string;
	links: { title: string; url: string }[];
}

export const LINK_CATEGORIES: LinkCategory[] = [
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

export function renderCategory(idx: number): string {
	const cat = LINK_CATEGORIES[idx];
	if (!cat) return "Unknown category";
	return `*${cat.name}*\n` + cat.links.map((l) => `• [${l.title}](${l.url})`).join("\n");
}
