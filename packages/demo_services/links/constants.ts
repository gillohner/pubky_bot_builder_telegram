import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

export const LINKS_SERVICE_ID = "links" as const;
export const LINKS_VERSION = "1.0.0" as const;
export const LINKS_COMMAND = "links" as const;

export interface LinkCategory {
	name: string;
	links: { title: string; url: string }[];
}

// JSON Schema for the categories dataset
// This schema enables the web config builder to generate forms
export const CATEGORIES_DATASET_SCHEMA: JSONSchema = {
	type: "object",
	title: "Link Categories",
	description: "Categories of links to display in the bot",
	properties: {
		categories: {
			type: "array",
			title: "Categories",
			description: "List of link categories",
			items: {
				type: "object",
				properties: {
					name: {
						type: "string",
						title: "Category Name",
						description: "Display name for this category",
						minLength: 1,
						maxLength: 50,
					},
					links: {
						type: "array",
						title: "Links",
						description: "Links in this category",
						items: {
							type: "object",
							properties: {
								title: {
									type: "string",
									title: "Link Title",
									minLength: 1,
									maxLength: 100,
								},
								url: {
									type: "string",
									title: "URL",
									format: "uri",
								},
							},
							required: ["title", "url"],
						},
						minItems: 1,
					},
				},
				required: ["name", "links"],
			},
			minItems: 1,
		},
	},
	required: ["categories"],
};

export const LINKS_DATASET_SCHEMAS: DatasetSchemas = {
	categories: {
		schema: CATEGORIES_DATASET_SCHEMA,
		description: "Link categories to display in the /links command",
		required: false,
		example: {
			categories: [
				{
					name: "Resources",
					links: [
						{ title: "Documentation", url: "https://docs.example.com" },
						{ title: "GitHub", url: "https://github.com/example" },
					],
				},
			],
		},
	},
};

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
		links: [
			{
				title: "Nitter",
				url: "https://nitter.net",
			},
			{
				title: "ProxiTok",
				url: "https://proxitok.pabloferreiro.es",
			},
		],
	},
];

export function renderCategory(idx: number): string {
	const cat = LINK_CATEGORIES[idx];
	if (!cat) return "Unknown category";
	return `*${cat.name}*\n` + cat.links.map((l) => `• [${l.title}](${l.url})`).join("\n");
}
