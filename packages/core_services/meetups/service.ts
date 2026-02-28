// packages/core_services/meetups/service.ts
// Meetups - Command flow service that displays upcoming events from Pubky calendars
import { defineService, del, none, runService, state, UIBuilder, uiKeyboard } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	buildCalendarHeader,
	computeEndDate,
	DEFAULT_CONFIG,
	DEFAULT_TIMELINE_OPTIONS,
	formatEventsMessage,
	MEETUPS_COMMAND,
	MEETUPS_CONFIG_SCHEMA,
	MEETUPS_DATASET_SCHEMAS,
	MEETUPS_REPLACE_GROUP,
	MEETUPS_SERVICE_ID,
	MEETUPS_VERSION,
	type MeetupsConfig,
	type MeetupsState,
	type NexusEvent,
	TIMELINE_LABELS,
	type TimelineRangeId,
} from "./constants.ts";

// ============================================================================
// Helpers
// ============================================================================

async function fetchEvents(
	config: MeetupsConfig,
	calendarIndices: number[],
	endDateMicros?: number,
): Promise<NexusEvent[]> {
	const allEvents: NexusEvent[] = [];
	const maxEvents = config.maxEvents ?? 10;
	const nowMicros = Date.now() * 1000;
	const baseUrl = config.nexusUrl.replace(/\/$/, "");

	const calendarsToFetch = calendarIndices.map((i) => config.calendars[i]).filter(Boolean);

	for (const cal of calendarsToFetch) {
		try {
			const params = new URLSearchParams({
				calendar: cal.uri,
				start_date: String(nowMicros),
				limit: String(maxEvents),
				status: "CONFIRMED",
			});
			if (endDateMicros) {
				params.set("end_date", String(endDateMicros));
			}
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
// Keyboard Builders
// ============================================================================

function buildCalendarKeyboard(
	calendars: MeetupsConfig["calendars"],
	serviceId: string,
) {
	const keyboard = UIBuilder.keyboard().namespace(serviceId);
	for (const [idx, cal] of calendars.entries()) {
		keyboard.callback(cal.name || `Calendar ${idx + 1}`, `cal:${idx}`);
		keyboard.row();
	}
	if (calendars.length > 1) {
		keyboard.callback("All Calendars", "cal:all");
		keyboard.row();
	}
	keyboard.callback("\u2716 Close", "close");
	return keyboard.build();
}

function buildTimelineKeyboard(
	options: TimelineRangeId[],
	showBack: boolean,
	serviceId: string,
) {
	const keyboard = UIBuilder.keyboard().namespace(serviceId);
	for (const opt of options) {
		keyboard.callback(TIMELINE_LABELS[opt], `time:${opt}`);
		keyboard.row();
	}
	if (showBack) {
		keyboard.callback("\u2190 Back", "back:cal");
	}
	keyboard.callback("\u2716 Close", "close");
	return keyboard.build();
}

function buildEventListKeyboard(
	hasMultipleCalendars: boolean,
	serviceId: string,
) {
	const keyboard = UIBuilder.keyboard().namespace(serviceId);
	keyboard.callback("\u2190 Change timeframe", "back:time");
	keyboard.row();
	if (hasMultipleCalendars) {
		keyboard.callback("\u2190 Change calendar", "back:cal");
		keyboard.row();
	}
	keyboard.callback("\u2716 Close", "close");
	return keyboard.build();
}

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
	id: MEETUPS_SERVICE_ID,
	version: MEETUPS_VERSION,
	kind: "command_flow",
	command: MEETUPS_COMMAND,
	description: "Display upcoming events from Pubky calendars",
	configSchema: MEETUPS_CONFIG_SCHEMA,
	datasetSchemas: MEETUPS_DATASET_SCHEMAS,
	net: ["__runtime__"],
	handlers: {
		command: (ev: CommandEvent) => {
			const rawConfig = ev.serviceConfig || {};
			const config: MeetupsConfig = { ...DEFAULT_CONFIG, ...rawConfig } as MeetupsConfig;

			if (!config.nexusUrl || !config.calendars?.length) {
				return uiKeyboard(
					UIBuilder.keyboard().namespace(MEETUPS_SERVICE_ID)
						.callback("\u2716 Close", "close").build(),
					"Meetups service is not configured. Please set a Nexus URL and calendar URIs.",
					{
						state: state.replace({}),
						options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
					},
				);
			}

			const hasMultiple = config.calendars.length > 1;

			if (hasMultiple) {
				// Show calendar picker
				const kb = buildCalendarKeyboard(config.calendars, MEETUPS_SERVICE_ID);
				return uiKeyboard(kb, "Select a calendar:", {
					state: state.replace({}),
					options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
				});
			}

			// Single calendar — skip to timeline picker
			const timeOpts = config.timelineOptions ?? DEFAULT_TIMELINE_OPTIONS;
			const kb = buildTimelineKeyboard(timeOpts, false, MEETUPS_SERVICE_ID);
			return uiKeyboard(kb, "Select a time range:", {
				state: state.replace({ selectedCalendar: 0 }),
				options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
			});
		},

		callback: async (ev: CallbackEvent) => {
			const data = ev.data;
			const rawConfig = ev.serviceConfig || {};
			const config: MeetupsConfig = { ...DEFAULT_CONFIG, ...rawConfig } as MeetupsConfig;
			const currentState = (ev.state || {}) as MeetupsState;
			const hasMultiple = (config.calendars?.length ?? 0) > 1;
			const timeOpts = config.timelineOptions ?? DEFAULT_TIMELINE_OPTIONS;

			// Close — delete message
			if (data === "close") {
				return del();
			}

			// Back to calendar picker
			if (data === "back:cal") {
				const kb = buildCalendarKeyboard(config.calendars, MEETUPS_SERVICE_ID);
				return uiKeyboard(kb, "Select a calendar:", {
					state: state.replace({}),
					options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
				});
			}

			// Back to timeline picker (preserves selectedCalendar)
			if (data === "back:time") {
				const kb = buildTimelineKeyboard(timeOpts, hasMultiple, MEETUPS_SERVICE_ID);
				return uiKeyboard(kb, "Select a time range:", {
					state: state.replace({ selectedCalendar: currentState.selectedCalendar }),
					options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
				});
			}

			// Calendar selection
			const calMatch = /^cal:(.+)$/.exec(data);
			if (calMatch) {
				const val = calMatch[1];
				const selectedCalendar: number | "all" = val === "all" ? "all" : Number(val);
				const kb = buildTimelineKeyboard(timeOpts, hasMultiple, MEETUPS_SERVICE_ID);
				return uiKeyboard(kb, "Select a time range:", {
					state: state.replace({ selectedCalendar }),
					options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
				});
			}

			// Timeline selection — fetch and display events
			const timeMatch = /^time:(.+)$/.exec(data);
			if (timeMatch) {
				const rangeId = timeMatch[1] as TimelineRangeId;
				const endDateMicros = computeEndDate(rangeId);
				const selectedCalendar = currentState.selectedCalendar ?? 0;

				// Determine which calendar indices to fetch
				const calendarIndices: number[] = selectedCalendar === "all"
					? config.calendars.map((_, i) => i)
					: [selectedCalendar as number];

				try {
					const events = await fetchEvents(config, calendarIndices, endDateMicros);
					const header = buildCalendarHeader(config, selectedCalendar);
					const rangeLabel = TIMELINE_LABELS[rangeId] || rangeId;
					const eventList = formatEventsMessage(events, rangeLabel);
					const text = header + eventList;
					const kb = buildEventListKeyboard(hasMultiple, MEETUPS_SERVICE_ID);

					return uiKeyboard(kb, text, {
						state: state.replace({ selectedCalendar, timeRange: rangeId }),
						options: {
							parse_mode: "HTML",
							disable_web_page_preview: true,
							replaceGroup: MEETUPS_REPLACE_GROUP,
						},
					});
				} catch (err) {
					console.error("Meetups fetch error:", (err as Error).message);
					const kb = buildEventListKeyboard(hasMultiple, MEETUPS_SERVICE_ID);
					return uiKeyboard(kb, "Failed to fetch upcoming events. Please try again.", {
						state: state.replace(currentState),
						options: { parse_mode: "HTML", replaceGroup: MEETUPS_REPLACE_GROUP },
					});
				}
			}

			return none();
		},

		message: (_ev: MessageEvent) => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
