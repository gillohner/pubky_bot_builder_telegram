// packages/core_services/meetups/service.ts
// Meetups - Single command service that displays upcoming events from Pubky calendars
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	DEFAULT_CONFIG,
	formatEventsMessage,
	MEETUPS_CONFIG_SCHEMA,
	MEETUPS_DATASET_SCHEMAS,
	MEETUPS_SERVICE_ID,
	MEETUPS_VERSION,
	type MeetupsConfig,
	type NexusEvent,
} from "./constants.ts";

// ============================================================================
// Helpers
// ============================================================================

async function fetchEvents(config: MeetupsConfig): Promise<NexusEvent[]> {
	const allEvents: NexusEvent[] = [];
	const maxEvents = config.maxEvents ?? 10;
	// Current time in microseconds (Nexus uses Unix microseconds)
	const nowMicros = Date.now() * 1000;
	const baseUrl = config.nexusUrl.replace(/\/$/, "");

	for (const cal of config.calendars) {
		try {
			const params = new URLSearchParams({
				calendar: cal.uri,
				start_date: String(nowMicros),
				limit: String(maxEvents),
				status: "CONFIRMED",
			});
			const url = `${baseUrl}/v0/stream/events?${params}`;
			const resp = await fetch(url);
			if (!resp.ok) {
				console.error(`Failed to fetch events for calendar ${cal.uri}: ${resp.status}`);
				continue;
			}
			const events = (await resp.json()) as NexusEvent[];
			allEvents.push(...events);
		} catch (err) {
			console.error(`Error fetching events for calendar ${cal.uri}:`, (err as Error).message);
		}
	}

	// Sort by dtstart ascending
	allEvents.sort((a, b) => {
		try {
			return new Date(a.dtstart).getTime() - new Date(b.dtstart).getTime();
		} catch {
			return 0;
		}
	});

	// Deduplicate by URI and limit
	const seen = new Set<string>();
	const unique: NexusEvent[] = [];
	for (const ev of allEvents) {
		const key = ev.uri || ev.summary + ev.dtstart;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(ev);
		if (unique.length >= maxEvents) break;
	}

	return unique;
}

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
	id: MEETUPS_SERVICE_ID,
	version: MEETUPS_VERSION,
	kind: "single_command",
	description: "Display upcoming events from Pubky calendars",
	configSchema: MEETUPS_CONFIG_SCHEMA,
	datasetSchemas: MEETUPS_DATASET_SCHEMAS,
	net: ["__runtime__"],
	handlers: {
		command: async (ev: CommandEvent) => {
			const rawConfig = ev.serviceConfig || {};
			const config: MeetupsConfig = { ...DEFAULT_CONFIG, ...rawConfig } as MeetupsConfig;

			if (!config.nexusUrl || !config.calendars?.length) {
				return reply("Meetups service is not configured. Please set a Nexus URL and calendar URIs.", {
					options: { parse_mode: "Markdown" },
				});
			}

			try {
				const events = await fetchEvents(config);
				const title = config.title || "Upcoming Events";
				const text = formatEventsMessage(events, title);

				return reply(text, {
					options: {
						parse_mode: config.parseMode || "Markdown",
						disable_web_page_preview: true,
					},
				});
			} catch (err) {
				console.error("Meetups fetch error:", (err as Error).message);
				return reply("Failed to fetch upcoming events. Please try again later.");
			}
		},
		callback: (_ev: CallbackEvent) => none(),
		message: (_ev: MessageEvent) => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
