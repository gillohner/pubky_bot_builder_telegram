// packages/core_services/url-cleaner/service.ts
// URL Cleaner - Listener service that cleans tracking parameters and offers alt frontends
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import { TidyURL } from "npm:tidy-url";
import {
	ALT_FRONTENDS_DATASET_SCHEMA,
	DEFAULT_ALT_FRONTENDS,
	DEFAULT_CONFIG,
	URL_CLEANER_CONFIG_SCHEMA,
	URL_CLEANER_DATASET_SCHEMAS,
	URL_CLEANER_SERVICE_ID,
	URL_CLEANER_VERSION,
	validateAltFrontendsDataset,
	validateConfig,
	type AltFrontendMapping,
	type AltFrontendsDataset,
} from "./constants.ts";

// ============================================================================
// URL Processing Logic
// ============================================================================

interface ProcessedUrl {
	original: string;
	cleaned: string;
	wasModified: boolean;
	removedParams: string[];
	altFrontend?: {
		name: string;
		url: string;
	};
}

/**
 * Extract URLs from message text
 */
function extractUrls(text: string): string[] {
	const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
	const matches = text.match(urlRegex) || [];
	// Remove trailing punctuation that might be captured
	return matches.map((url) => url.replace(/[.,;:!?)]+$/, ""));
}

/**
 * Clean a URL using tidy-url
 */
function cleanUrl(url: string): { cleaned: string; removed: string[] } {
	try {
		const result = TidyURL.clean(url);
		// tidy-url may return key-value pairs or strings
		const rawRemoved = result.info?.removed || [];
		const removed = rawRemoved.map((r: unknown) =>
			typeof r === "string" ? r : (r as { key?: string })?.key || String(r)
		);
		return { cleaned: result.url, removed };
	} catch {
		// If tidy-url fails, return original
		return { cleaned: url, removed: [] };
	}
}

/**
 * Apply alt-frontend mappings to a URL
 */
function applyAltFrontend(
	url: string,
	mappings: AltFrontendMapping[],
): { name: string; url: string } | undefined {
	for (const mapping of mappings) {
		// Skip disabled mappings
		if (mapping.enabled === false) continue;

		try {
			const regex = new RegExp(mapping.pattern, "i");
			const match = url.match(regex);

			if (match) {
				// Check path pattern if specified
				if (mapping.pathPattern) {
					const urlObj = new URL(url);
					const pathRegex = new RegExp(mapping.pathPattern, "i");
					if (!pathRegex.test(urlObj.pathname)) {
						continue;
					}
				}

				// Apply replacement
				const altUrl = url.replace(regex, mapping.replacement);
				return { name: mapping.name, url: altUrl };
			}
		} catch {
			// Skip invalid regex patterns
			continue;
		}
	}
	return undefined;
}

/**
 * Process a single URL
 */
function processUrl(url: string, mappings: AltFrontendMapping[]): ProcessedUrl {
	const { cleaned, removed } = cleanUrl(url);
	const wasModified = cleaned !== url;
	const altFrontend = applyAltFrontend(cleaned, mappings);

	return {
		original: url,
		cleaned,
		wasModified,
		removedParams: removed,
		altFrontend,
	};
}

// ============================================================================
// Response Formatting
// ============================================================================

interface ServiceConfig {
	showOriginalUrl?: boolean;
	showCleanedUrl?: boolean;
	showRemovedParams?: boolean;
	silentIfUnchanged?: boolean;
	maxUrlsPerMessage?: number;
}

/**
 * Format a single processed URL for the response message
 */
function formatUrlResult(
	result: ProcessedUrl,
	config: ServiceConfig,
): string | null {
	const parts: string[] = [];
	const silentIfUnchanged = config.silentIfUnchanged ?? DEFAULT_CONFIG.silentIfUnchanged;

	// If nothing changed and no alt-frontend, and silent mode is on, return null
	if (!result.wasModified && !result.altFrontend && silentIfUnchanged) {
		return null;
	}

	// Show original if configured
	if (config.showOriginalUrl) {
		parts.push(`📎 *Original:* \`${result.original}\``);
	}

	// Show cleaned URL if modified
	if (result.wasModified && (config.showCleanedUrl ?? DEFAULT_CONFIG.showCleanedUrl)) {
		parts.push(`🧹 *Cleaned:* ${result.cleaned}`);
	}

	// Show removed params if configured
	if (result.wasModified && config.showRemovedParams && result.removedParams.length > 0) {
		parts.push(`🗑️ *Removed:* ${result.removedParams.join(", ")}`);
	}

	// Show alt-frontend if available
	if (result.altFrontend) {
		parts.push(`🔄 *${result.altFrontend.name}:* ${result.altFrontend.url}`);
	}

	// If we have nothing to show, return null
	if (parts.length === 0) {
		return null;
	}

	return parts.join("\n");
}

/**
 * Format multiple URL results
 */
function formatResults(results: ProcessedUrl[], config: ServiceConfig): string | null {
	const formatted = results
		.map((r) => formatUrlResult(r, config))
		.filter((r): r is string => r !== null);

	if (formatted.length === 0) {
		return null;
	}

	if (formatted.length === 1) {
		return formatted[0];
	}

	// Multiple URLs - add separators
	return formatted.map((r, i) => `*URL ${i + 1}:*\n${r}`).join("\n\n");
}

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
	id: URL_CLEANER_SERVICE_ID,
	version: URL_CLEANER_VERSION,
	kind: "listener",
	description: "Automatically cleans tracking parameters from URLs and suggests privacy-friendly alternatives",
	npmDependencies: ["tidy-url"],
	configSchema: URL_CLEANER_CONFIG_SCHEMA,
	datasetSchemas: URL_CLEANER_DATASET_SCHEMAS,
	handlers: {
		command: (_ev: CommandEvent) => none(),
		callback: (_ev: CallbackEvent) => none(),
		message: (ev: MessageEvent) => {
			// Get message text
			const msg = ev.message as { text?: string } | undefined;
			const text = msg?.text || "";

			if (!text) {
				return none();
			}

			// Extract URLs from message
			const urls = extractUrls(text);
			if (urls.length === 0) {
				return none();
			}

			// Get config with defaults
			const rawConfig = ev.serviceConfig || {};
			const configValidation = validateConfig(rawConfig);
			if (!configValidation.valid) {
				// Log validation errors but continue with defaults
				console.error("URL Cleaner config validation errors:", configValidation.errors);
			}
			const config: ServiceConfig = { ...DEFAULT_CONFIG, ...rawConfig };

			// Get alt-frontends dataset
			let altFrontends: AltFrontendsDataset = DEFAULT_ALT_FRONTENDS;
			const datasets = ev.datasets as Record<string, unknown> | undefined;
			if (datasets?.altFrontends) {
				const validation = validateAltFrontendsDataset(datasets.altFrontends);
				if (validation.valid) {
					altFrontends = datasets.altFrontends as AltFrontendsDataset;
				} else {
					console.error("URL Cleaner altFrontends dataset validation errors:", validation.errors);
				}
			}

			// Limit URLs processed
			const maxUrls = config.maxUrlsPerMessage ?? DEFAULT_CONFIG.maxUrlsPerMessage;
			const urlsToProcess = urls.slice(0, maxUrls);

			// Process each URL
			const results = urlsToProcess.map((url) => processUrl(url, altFrontends.mappings));

			// Format results
			const message = formatResults(results, config);

			if (!message) {
				return none();
			}

			return reply(message, {
				options: {
					parse_mode: "Markdown",
					disable_web_page_preview: true,
				},
			});
		},
	},
});

export default service;
if (import.meta.main) await runService(service);
