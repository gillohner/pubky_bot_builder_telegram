// src/core/pubky/pubky.ts
// Multi-layered Pubky config system supporting Bot Config -> Service Config -> Service Registry

export interface PubkyServiceRegistryEntry {
	id: string;
	name: string;
	kind: "single_command" | "command_flow" | "listener";
	source: {
		type: "jsr" | "github" | "local";
		location: string; // JSR package, GitHub repo, or pubky:// path for local
		entry?: string; // entry point for GitHub/local sources
		version?: string; // for JSR/GitHub
	};
}

export interface PubkyServiceRegistry {
	registryId: string;
	description?: string;
	services: PubkyServiceRegistryEntry[];
}

export interface PubkyServiceConfig {
	configId: string;
	name: string;
	description?: string;
	// Option A: registry-based lookup
	registryRef?: string; // pubky:// URL to service registry
	serviceId?: string; // ID from the registry
	// Option B: inline source (no registry)
	kind?: "single_command" | "command_flow" | "listener";
	source?: PubkyServiceRegistryEntry["source"]; // direct source descriptor
	// Common
	command: string; // command token without leading '/'
	config?: Record<string, unknown>; // service-specific configuration
	datasets?: Record<string, string>; // name -> pubky:// URL mappings
}

export interface PubkyBotServiceRef {
	serviceConfigRef: string; // pubky:// URL to service config
	overrides?: {
		command?: string; // override the command from service config
		config?: Record<string, unknown>; // merge with service config
		datasets?: Record<string, string>; // merge with service datasets
	};
	adminOnly?: boolean;
}

export interface PubkyBotConfig {
	configId: string;
	description?: string;
	version?: string;
	services: PubkyBotServiceRef[];
	listeners: PubkyBotServiceRef[];
}

// Legacy interface for backward compatibility
export interface PubkyServiceSpec {
	name: string;
	command: string;
	kind: "single_command" | "command_flow" | "listener";
	entry: string;
	version?: string;
	source?: string;
	config?: Record<string, unknown>;
}

export interface PubkyBotConfigTemplate {
	configId: string;
	services: PubkyServiceSpec[];
	listeners: PubkyServiceSpec[];
}

// Built-in template set for development/testing
const TEMPLATES: Record<string, PubkyBotConfigTemplate> = {
	default: {
		configId: "default",
		services: [
			{
				name: "Hello",
				command: "hello",
				kind: "single_command",
				entry: "./packages/demo_services/hello/service.ts",
				version: "1.0.0",
			},
			{
				name: "Links",
				command: "links",
				kind: "single_command",
				entry: "./packages/demo_services/links/service.ts",
			},
			{
				name: "Survey",
				command: "survey",
				kind: "command_flow",
				entry: "./packages/demo_services/survey/service.ts",
			},
			{
				name: "Security Probe",
				command: "secprobe",
				kind: "single_command",
				entry: "./packages/demo_services/security_probe/service.ts",
				config: { admin_only: true },
			},
			{
				name: "Media Demo",
				command: "media",
				kind: "command_flow",
				entry: "./packages/demo_services/media_demo/service.ts",
				config: {
					datasets: {
						gallery: "pubky://demo/pub/pubky-bot-builder/datasets/gallery.json",
					},
				},
			},
			{
				name: "UI Demo",
				command: "ui",
				kind: "command_flow",
				entry: "./packages/demo_services/ui_demo/service.ts",
				config: {
					datasets: {
						carousel: "pubky://demo/pub/pubky-bot-builder/datasets/carousel.json",
						broken: "pubky://demo/pub/pubky-bot-builder/datasets/broken.json",
					},
				},
			},
			{
				name: "Event Creator",
				command: "newevent",
				kind: "command_flow",
				entry: "./packages/demo_services/event_creator/service.ts",
				config: {
					// calendarUri: "pubky://your-pk/pub/eventky.app/calendars/your-calendar-id",
					defaultTimezone: "UTC",
					requireLocation: false,
				},
			},
		],
		listeners: [
			{
				name: "Listener",
				command: "listener",
				kind: "listener",
				entry: "./packages/demo_services/listener/service.ts",
			},
		],
	},
	// Example of new modular config structure
	modular: {
		configId: "modular",
		services: [
			{
				name: "Hello (from modular)",
				command: "hello",
				kind: "single_command",
				entry: "./packages/demo_services/hello/service.ts",
				config: { greeting: "Modular hello!" },
			},
		],
		listeners: [],
	},
	fake: {
		configId: "fake",
		services: [
			{
				name: "Fake Hello",
				command: "hello",
				kind: "single_command",
				entry: "./packages/demo_services/hello/service.ts",
				config: { greeting: "FAKE template override!" },
				version: "1.0.0",
				source: "local",
			},
			{
				name: "Links",
				command: "links",
				kind: "single_command",
				entry: "./packages/demo_services/links/service.ts",
			},
			{
				name: "Security Probe",
				command: "secprobe",
				kind: "single_command",
				entry: "./packages/demo_services/security_probe/service.ts",
			},
			{
				name: "UI Demo",
				command: "ui",
				kind: "command_flow",
				entry: "./packages/demo_services/ui_demo/service.ts",
			},
			{
				name: "Media Demo",
				command: "mediatest",
				kind: "command_flow",
				entry: "./packages/demo_services/media_demo/service.ts",
			},
		],
		listeners: [
			{
				name: "Listener",
				command: "listener",
				kind: "listener",
				entry: "./packages/demo_services/listener/service.ts",
			},
		],
	},
	bad: {
		configId: "bad",
		services: [
			{
				name: "Bad Dataset",
				command: "baddata",
				kind: "single_command",
				entry: "./packages/demo_services/bad_dataset/service.ts",
			},
		],
		listeners: [],
	},
};

/**
 * Convert a pubky:// URL to Address format for publicStorage
 * The SDK accepts both 'pubky<pk>/pub/...' and 'pubky://<pk>/pub/...' formats
 */
function pubkyUrlToAddress(url: string): `pubky://${string}/pub/${string}` {
	if (!url.startsWith("pubky://")) {
		throw new Error(`Invalid pubky URL: ${url}`);
	}
	// pubky:// URLs are valid Address type as-is
	return url as `pubky://${string}/pub/${string}`;
}

/**
 * Fetch and resolve a complete bot configuration from Pubky.
 * Supports both legacy single-file configs and new modular configs.
 */
export async function fetchPubkyConfig(url: string): Promise<PubkyBotConfigTemplate> {
	const key = url.trim();

	if (key.startsWith("pubky://")) {
		const { Pubky } = await import("@synonymdev/pubky");
		const pubky = new Pubky();
		const publicStorage = pubky.publicStorage;
		console.log("Fetching Pubky config from", key);

		const address = pubkyUrlToAddress(key);
		const json = await publicStorage.getJson(address);
		console.log("Fetched Pubky config:", json);

		// Check if this is a new modular bot config
		if (
			json && typeof json === "object" && (json as Record<string, unknown>).services &&
			Array.isArray((json as Record<string, unknown>).services)
		) {
			const services = (json as Record<string, unknown>).services as unknown[];
			if (
				services.length > 0 && typeof services[0] === "object" && services[0] !== null &&
				(services[0] as Record<string, unknown>).serviceConfigRef
			) {
				// Create a wrapper to match our PubkyClient interface
				const clientWrapper: PubkyClient = {
					async fetch(url: string) {
						try {
							const addr = pubkyUrlToAddress(url);
							const data = await publicStorage.getJson(addr);
							return {
								ok: true,
								status: 200,
								statusText: "OK",
								json: () => Promise.resolve(data),
							};
						} catch (e) {
							const err = e as { data?: { statusCode?: number } };
							const statusCode = err.data?.statusCode ?? 500;
							return {
								ok: false,
								status: statusCode,
								statusText: (e as Error).message,
								json: () => Promise.reject(e),
							};
						}
					},
				};
				return await resolveModularBotConfig(json as PubkyBotConfig, clientWrapper);
			}
		}

		// Legacy single-file config
		return json as PubkyBotConfigTemplate;
	}

	// Local templates
	if (!TEMPLATES[key]) throw new Error(`Unknown Pubky config template: ${key}`);
	return structuredClone(TEMPLATES[key]);
}

export function listPubkyTemplateIds(): string[] {
	return Object.keys(TEMPLATES);
}

// Interface for Pubky client to avoid 'any' type
interface PubkyClient {
	fetch(url: string): Promise<{
		ok: boolean;
		status: number;
		statusText: string;
		json(): Promise<unknown>;
	}>;
}

/**
 * Resolve a modular bot config by fetching referenced service configs and registries
 */
async function resolveModularBotConfig(
	botConfig: PubkyBotConfig,
	client: PubkyClient,
): Promise<PubkyBotConfigTemplate> {
	const resolvedServices: PubkyServiceSpec[] = [];
	const resolvedListeners: PubkyServiceSpec[] = [];

	// Process services
	for (const serviceRef of botConfig.services) {
		const resolved = await resolveServiceRef(serviceRef, client);
		if (resolved.kind === "listener") {
			resolvedListeners.push(resolved);
		} else {
			resolvedServices.push(resolved);
		}
	}

	// Process listeners
	for (const listenerRef of botConfig.listeners) {
		const resolved = await resolveServiceRef(listenerRef, client);
		resolvedListeners.push(resolved);
	}

	return {
		configId: botConfig.configId,
		services: resolvedServices,
		listeners: resolvedListeners,
	};
}

/**
 * Resolve a single service reference by fetching its config and registry
 */
async function resolveServiceRef(
	serviceRef: PubkyBotServiceRef,
	client: PubkyClient,
): Promise<PubkyServiceSpec> {
	// Fetch service config
	const configResponse = await client.fetch(serviceRef.serviceConfigRef);
	if (!configResponse.ok) {
		throw new Error(`Failed to fetch service config from ${serviceRef.serviceConfigRef}`);
	}
	const serviceConfig = await configResponse.json() as PubkyServiceConfig;

	// Two resolution paths:
	// A) Registry-based: registryRef + serviceId
	// B) Inline: kind + source
	let resolvedKind: PubkyServiceRegistryEntry["kind"];
	let resolvedSource: PubkyServiceRegistryEntry["source"];
	let resolvedName = serviceConfig.name;
	let resolvedVersion: string | undefined;

	if (serviceConfig.registryRef && serviceConfig.serviceId) {
		// A) Registry-based resolution
		const registryResponse = await client.fetch(serviceConfig.registryRef);
		if (!registryResponse.ok) {
			throw new Error(`Failed to fetch service registry from ${serviceConfig.registryRef}`);
		}
		const registry = await registryResponse.json() as PubkyServiceRegistry;

		const registryEntry = registry.services.find((s) => s.id === serviceConfig.serviceId);
		if (!registryEntry) {
			throw new Error(
				`Service ${serviceConfig.serviceId} not found in registry ${serviceConfig.registryRef}`,
			);
		}
		resolvedKind = registryEntry.kind;
		resolvedSource = registryEntry.source;
		// Prefer service-config name; fallback to registry name
		resolvedName = serviceConfig.name || registryEntry.name;
		resolvedVersion = registryEntry.source.version;
	} else if (serviceConfig.kind && serviceConfig.source) {
		// B) Inline resolution
		resolvedKind = serviceConfig.kind;
		resolvedSource = serviceConfig.source;
		resolvedVersion = serviceConfig.source.version;
	} else {
		throw new Error(
			"Invalid service config: expected either { registryRef, serviceId } or { kind, source }",
		);
	}

	// Resolve datasets by fetching JSON blobs
	const resolvedDatasets: Record<string, unknown> = {};
	const allDatasets = {
		...serviceConfig.datasets,
		...serviceRef.overrides?.datasets,
	};

	for (const [name, url] of Object.entries(allDatasets || {})) {
		if (typeof url === "string" && url.startsWith("pubky://")) {
			try {
				const dataResponse = await client.fetch(url);
				if (dataResponse.ok) {
					resolvedDatasets[name] = await dataResponse.json();
				} else {
					console.warn(`Failed to fetch dataset ${name} from ${url}`);
					resolvedDatasets[name] = { __error: `Failed to fetch: ${dataResponse.status}` };
				}
			} catch (error) {
				console.warn(`Error fetching dataset ${name} from ${url}:`, error);
				resolvedDatasets[name] = { __error: `Fetch error: ${error}` };
			}
		}
	}

	// Build the resolved service spec
	const entry = determineServiceEntry({
		id: serviceConfig.serviceId ?? serviceConfig.configId,
		name: resolvedName,
		kind: resolvedKind,
		source: resolvedSource,
	});
	const command = serviceRef.overrides?.command || serviceConfig.command;
	const config = {
		...serviceConfig.config,
		...serviceRef.overrides?.config,
		datasets: resolvedDatasets,
	};

	return {
		name: resolvedName,
		command,
		kind: resolvedKind,
		entry,
		version: resolvedVersion,
		source: `${resolvedSource.type}:${resolvedSource.location}`,
		config: Object.keys(config).length > 0 ? config : undefined,
	};
}

/**
 * Determine the entry point for a service based on its registry entry
 */
function determineServiceEntry(registryEntry: PubkyServiceRegistryEntry): string {
	switch (registryEntry.source.type) {
		case "local":
			// For local services, the entry is a direct path or the configured entry point
			return registryEntry.source.entry || registryEntry.source.location;
		case "jsr":
			// For JSR packages, we'll need to resolve this at runtime
			return `jsr:${registryEntry.source.location}@${registryEntry.source.version || "latest"}`;
		case "github":
			// For GitHub, we'll need to resolve this at runtime
			return `github:${registryEntry.source.location}${
				registryEntry.source.entry ? "#" + registryEntry.source.entry : ""
			}`;
		default:
			throw new Error(`Unsupported service source type: ${registryEntry.source.type}`);
	}
}
