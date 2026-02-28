// packages/core_services/meetups/service.ts
// Meetups - Command flow service that displays upcoming events from Pubky calendars
import { defineService, del, none, runService, state, UIBuilder, uiKeyboard } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import rruleLib from "npm:rrule@2";
const { RRule, RRuleSet } = rruleLib;
import {
	buildCalendarHeader,
	computeEndDate,
	computeOccurrenceEnd,
	DEFAULT_CONFIG,
	DEFAULT_TIMELINE_OPTIONS,
	type EventOccurrence,
	extractLocationName,
	formatEventsMessage,
	MEETUPS_COMMAND,
	MEETUPS_CONFIG_SCHEMA,
	MEETUPS_DATASET_SCHEMAS,
	MEETUPS_REPLACE_GROUP,
	MEETUPS_SERVICE_ID,
	MEETUPS_VERSION,
	type MeetupsConfig,
	type MeetupsState,
	type NexusCalendarView,
	type NexusEventDetails,
	type NexusEventView,
	parseCalendarUri,
	parseEventUri,
	TIMELINE_LABELS,
	type TimelineRangeId,
} from "./constants.ts";

// ============================================================================
// Recurrence Expansion
// ============================================================================

/**
 * Parse a naive datetime string as a "UTC" Date for rrule processing.
 * Event dtstart values like "2026-01-08T19:00:14" are local times (no Z suffix).
 * We treat them as UTC for rrule computation to avoid timezone library dependency.
 * The small timezone offset error (±12h) is acceptable for week/2week/30day ranges.
 */
function parseAsUtc(dateStr: string): Date {
	// If already has timezone info, parse directly
	if (dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
		return new Date(dateStr);
	}
	// Treat naive datetime as UTC
	return new Date(dateStr + "Z");
}

/**
 * Expand an event's recurrence rules into individual occurrences within a time window.
 * Returns occurrences sorted by date.
 */
function expandOccurrences(
	event: NexusEventDetails,
	windowStart: Date,
	windowEnd: Date,
): EventOccurrence[] {
	const isRecurring = !!(event.rrule || (event.rdate && event.rdate.length > 0));
	const locationName = extractLocationName(event.locations);

	if (!isRecurring) {
		// Non-recurring: check if dtstart falls within the window
		const start = parseAsUtc(event.dtstart);
		if (start >= windowStart && start <= windowEnd) {
			return [{
				summary: event.summary,
				description: event.description,
				occurrenceStart: event.dtstart,
				occurrenceEnd: computeOccurrenceEnd(event.dtstart, event),
				uri: event.uri,
				isRecurring: false,
				locationName,
			}];
		}
		return [];
	}

	// Build RRuleSet for recurrence expansion
	const rruleSet = new RRuleSet();
	const dtstart = parseAsUtc(event.dtstart);

	// Add the RRULE if present
	if (event.rrule) {
		try {
			const ruleOptions = RRule.parseString(event.rrule);
			ruleOptions.dtstart = dtstart;
			rruleSet.rrule(new RRule(ruleOptions));
		} catch (err) {
			console.error(`Failed to parse RRULE "${event.rrule}" for ${event.uri}:`, err);
			// Fall back to just dtstart
			rruleSet.rdate(dtstart);
		}
	} else {
		// No rrule but has rdate — include dtstart as first occurrence
		rruleSet.rdate(dtstart);
	}

	// Add RDATEs
	if (event.rdate) {
		for (const rd of event.rdate) {
			try {
				rruleSet.rdate(parseAsUtc(rd));
			} catch {
				// skip unparseable rdates
			}
		}
	}

	// Add EXDATEs
	if (event.exdate) {
		for (const ex of event.exdate) {
			try {
				rruleSet.exdate(parseAsUtc(ex));
			} catch {
				// skip unparseable exdates
			}
		}
	}

	// Get occurrences in the window
	const occurrences = rruleSet.between(windowStart, windowEnd, true);

	return occurrences.map((occDate) => {
		// Convert back to naive ISO string matching the event's local time convention
		const isoStr = occDate.toISOString().replace("Z", "");
		return {
			summary: event.summary,
			description: event.description,
			occurrenceStart: isoStr,
			occurrenceEnd: computeOccurrenceEnd(isoStr, event),
			uri: event.uri,
			isRecurring: true,
			locationName,
		};
	});
}

// ============================================================================
// Fetching
// ============================================================================

/**
 * Fetch all event URIs for a calendar via the Nexus calendar view endpoint.
 */
async function fetchCalendarEventUris(
	baseUrl: string,
	calendarUri: string,
): Promise<string[]> {
	const parsed = parseCalendarUri(calendarUri);
	if (!parsed) {
		console.error(`Invalid calendar URI: ${calendarUri}`);
		return [];
	}
	const url = `${baseUrl}/v0/calendar/${parsed.authorId}/${parsed.calendarId}`;
	const resp = await fetch(url);
	if (!resp.ok) {
		console.error(`Failed to fetch calendar ${calendarUri}: ${resp.status}`);
		return [];
	}
	const data = (await resp.json()) as NexusCalendarView;
	return data.events || [];
}

/**
 * Fetch a single event's full details from Nexus.
 */
async function fetchEventDetails(
	baseUrl: string,
	eventUri: string,
): Promise<NexusEventDetails | null> {
	const parsed = parseEventUri(eventUri);
	if (!parsed) {
		console.error(`Invalid event URI: ${eventUri}`);
		return null;
	}
	const url = `${baseUrl}/v0/event/${parsed.authorId}/${parsed.eventId}`;
	const resp = await fetch(url);
	if (!resp.ok) {
		console.error(`Failed to fetch event ${eventUri}: ${resp.status}`);
		return null;
	}
	const data = (await resp.json()) as NexusEventView;
	return data.details;
}

/**
 * Fetch events for the specified calendars, expand recurrences, and return
 * occurrences sorted by date within the given time window.
 */
async function fetchEvents(
	config: MeetupsConfig,
	calendarIndices: number[],
	windowEnd: Date,
): Promise<EventOccurrence[]> {
	const maxEvents = config.maxEvents ?? 10;
	const baseUrl = (config.nexusUrl || "https://nexus.eventky.app").replace(/\/$/, "");
	const windowStart = new Date();
	const calendarsToFetch = calendarIndices.map((i) => config.calendars[i]).filter(Boolean);

	// Step 1: Fetch event URIs from all calendars
	const allEventUris = new Set<string>();
	for (const cal of calendarsToFetch) {
		try {
			const uris = await fetchCalendarEventUris(baseUrl, cal.uri);
			for (const uri of uris) allEventUris.add(uri);
		} catch (err) {
			console.error(`Error fetching calendar ${cal.uri}:`, (err as Error).message);
		}
	}

	if (allEventUris.size === 0) return [];

	// Step 2: Fetch event details in parallel (limit to 30 events max)
	const urisToFetch = [...allEventUris].slice(0, 30);
	const eventPromises = urisToFetch.map((uri) =>
		fetchEventDetails(baseUrl, uri).catch((err) => {
			console.error(`Error fetching event ${uri}:`, (err as Error).message);
			return null;
		})
	);
	const events = (await Promise.all(eventPromises)).filter(
		(e): e is NexusEventDetails => e !== null,
	);

	// Step 3: Filter to CONFIRMED events (or events without status)
	const confirmed = events.filter((e) => !e.status || e.status === "CONFIRMED");

	// Step 4: Expand recurrences and collect all occurrences in the window
	const allOccurrences: EventOccurrence[] = [];
	for (const event of confirmed) {
		const occurrences = expandOccurrences(event, windowStart, windowEnd);
		allOccurrences.push(...occurrences);
	}

	// Step 5: Sort by occurrence date ascending
	allOccurrences.sort((a, b) => {
		return new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime();
	});

	// Step 6: Deduplicate by event URI + occurrence date, then limit
	const seen = new Set<string>();
	const unique: EventOccurrence[] = [];
	for (const occ of allOccurrences) {
		const key = `${occ.uri}|${occ.occurrenceStart}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(occ);
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
	npmDependencies: ["rrule"],
	configSchema: MEETUPS_CONFIG_SCHEMA,
	datasetSchemas: MEETUPS_DATASET_SCHEMAS,
	net: ["__runtime__"],
	handlers: {
		command: (ev: CommandEvent) => {
			const rawConfig = ev.serviceConfig || {};
			const config: MeetupsConfig = { ...DEFAULT_CONFIG, ...rawConfig } as MeetupsConfig;

			if (!config.calendars?.length) {
				return uiKeyboard(
					UIBuilder.keyboard().namespace(MEETUPS_SERVICE_ID)
						.callback("\u2716 Close", "close").build(),
					"Meetups service is not configured. Please set at least one calendar URI.",
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
				const windowEnd = computeEndDate(rangeId);
				const selectedCalendar = currentState.selectedCalendar ?? 0;

				// Determine which calendar indices to fetch
				const calendarIndices: number[] = selectedCalendar === "all"
					? config.calendars.map((_, i) => i)
					: [selectedCalendar as number];

				try {
					const occurrences = await fetchEvents(config, calendarIndices, windowEnd);
					const header = buildCalendarHeader(config, selectedCalendar);
					const rangeLabel = TIMELINE_LABELS[rangeId] || rangeId;
					const eventList = formatEventsMessage(occurrences, rangeLabel);
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
