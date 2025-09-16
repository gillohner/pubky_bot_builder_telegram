// src/core/pubky/pubky.ts
// Stub implementation of Pubky config fetch. Returns a static template mapping
// service identifiers to locally bundled example service modules.

export interface PubkyServiceSpec {
	name: string; // human readable
	command: string; // command token without leading '/'
	kind: "single_command" | "command_flow" | "listener";
	entry: string; // local relative path to service source
	version?: string; // optional service version (overrides service manifest if provided)
	source?: string; // origin reference (e.g., jsr:@scope/pkg@version) for future package resolution
	config?: Record<string, unknown>;
}

export interface PubkyBotConfigTemplate {
	configId: string;
	services: PubkyServiceSpec[];
	listeners: PubkyServiceSpec[]; // subset where kind === listener
}

// Built-in template set. Add new variants here.
const TEMPLATES: Record<string, PubkyBotConfigTemplate> = {
	default: {
		configId: "default",
		services: [
			{
				name: "Hello",
				command: "hello",
				kind: "single_command",
				entry: "./src/example_services/hello/service.ts",
				version: "1.0.0",
			},
			{
				name: "Photo",
				command: "photo",
				kind: "single_command",
				entry: "./src/example_services/photo/service.ts",
			},
			{
				name: "Links",
				command: "links",
				kind: "single_command",
				entry: "./src/example_services/links/service.ts",
			},
			{
				name: "Env Probe",
				command: "env",
				kind: "single_command",
				entry: "./src/example_services/env_probe/service.ts",
			},
			{
				name: "Survey",
				command: "survey",
				kind: "command_flow",
				entry: "./src/example_services/survey/service.ts",
			},
			{
				name: "Security Probe",
				command: "secprobe",
				kind: "single_command",
				entry: "./src/example_services/security_probe/service.ts",
			},
			{
				name: "Media Demo",
				command: "media",
				kind: "command_flow",
				entry: "./src/example_services/media_demo/service.ts",
			},
			{
				name: "UI Demo",
				command: "ui",
				kind: "command_flow",
				entry: "./src/example_services/ui_demo/service.ts",
			},
		],
		listeners: [
			{
				name: "Listener",
				command: "listener",
				kind: "listener",
				entry: "./src/example_services/listener/service.ts",
			},
		],
	},
	fake: {
		configId: "fake",
		services: [
			{
				name: "Fake Hello",
				command: "hello",
				kind: "single_command",
				entry: "./src/example_services/hello/service.ts",
				config: { greeting: "FAKE template override!" },
				version: "1.0.0",
				source: "local",
			},
			{
				name: "Links",
				command: "links",
				kind: "single_command",
				entry: "./src/example_services/links/service.ts",
			},
			{
				name: "Security Probe",
				command: "secprobe",
				kind: "single_command",
				entry: "./src/example_services/security_probe/service.ts",
			},
			{
				name: "UI Demo",
				command: "ui",
				kind: "command_flow",
				entry: "./src/example_services/ui_demo/service.ts",
			},
			{
				name: "Media Demo",
				command: "media",
				kind: "command_flow",
				entry: "./src/example_services/media_demo/service.ts",
			},
		],
		listeners: [
			{
				name: "Listener",
				command: "listener",
				kind: "listener",
				entry: "./src/example_services/listener/service.ts",
			},
		],
	},
};

export function fetchPubkyConfig(urlOrId: string): PubkyBotConfigTemplate {
	// Accept either explicit template id ("default") or a fake pubky:// URL whose basename matches an id.
	let key = urlOrId.trim();
	if (key.startsWith("pubky://")) {
		const last = key.split("/").pop();
		if (last) key = last.replace(/\.json$/i, "");
	}
	if (!TEMPLATES[key]) throw new Error(`Unknown Pubky config template: ${key}`);
	return structuredClone(TEMPLATES[key]);
}

export function listPubkyTemplateIds(): string[] {
	return Object.keys(TEMPLATES);
}
