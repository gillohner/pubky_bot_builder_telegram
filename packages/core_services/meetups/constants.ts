// packages/core_services/meetups/constants.ts
// Meetups - Command flow service that displays upcoming events from Pubky calendars

import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

// ============================================================================
// Service Identity
// ============================================================================

export const MEETUPS_SERVICE_ID = "meetups" as const;
export const MEETUPS_VERSION = "2.0.0" as const;
export const MEETUPS_COMMAND = "meetups" as const;
export const MEETUPS_REPLACE_GROUP = "meetups_menu" as const;

// ============================================================================
// Types
// ============================================================================

export interface CalendarSource {
	/** Pubky calendar URI */
	uri: string;
	/** Display name for this calendar */
	name?: string;
}

export interface MeetupsConfig {
	/** Nexus API base URL for fetching events */
	nexusUrl: string;
	/** Pubky calendar URIs to fetch events from */
	calendars: CalendarSource[];
	/** Header text (default: "Upcoming Events") */
	title?: string;
	/** Max events to show (default: 10) */
	maxEvents?: number;
	/** Parse mode (default: "HTML") */
	parseMode?: "Markdown" | "HTML" | "MarkdownV2";
	/** Show calendar title with eventky link above events (default: true) */
	showCalendarTitle?: boolean;
	/** Base URL for eventky web app (default: "https://app.eventky.com") */
	eventkyBaseUrl?: string;
	/** Which timeline options to offer (default: all three) */
	timelineOptions?: TimelineRangeId[];
}

export interface MeetupsState {
	[key: string]: unknown;
	selectedCalendar?: number | "all";
	timeRange?: string;
}

export type TimelineRangeId = "week" | "2weeks" | "30days";

export const TIMELINE_LABELS: Record<TimelineRangeId, string> = {
	week: "This week",
	"2weeks": "Next 2 weeks",
	"30days": "Next 30 days",
};

export const DEFAULT_TIMELINE_OPTIONS: TimelineRangeId[] = ["week", "2weeks", "30days"];

/** Subset of Nexus EventStreamItem fields we use */
export interface NexusEvent {
	summary: string;
	dtstart: string;
	dtend?: string;
	dtstart_tzid?: string;
	description?: string;
	uri?: string;
	author?: string;
	id?: string;
}

// ============================================================================
// JSON Schemas
// ============================================================================

export const CALENDAR_SOURCE_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		uri: {
			type: "string",
			title: "Calendar URI",
			description: "Pubky calendar URI (e.g., pubky://<pk>/pub/eventky.app/calendars/<id>)",
			minLength: 1,
		},
		name: {
			type: "string",
			title: "Calendar Name",
			description: "Display name for this calendar (optional)",
			maxLength: 100,
		},
	},
	required: ["uri"],
};

export const MEETUPS_CONFIG_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		nexusUrl: {
			type: "string",
			title: "Nexus API URL",
			description: "Base URL of the Nexus indexer API (e.g., https://nexus.example.com)",
			minLength: 1,
		},
		calendars: {
			type: "array",
			title: "Calendars",
			description: "Pubky calendar URIs to fetch events from",
			items: CALENDAR_SOURCE_SCHEMA,
			minItems: 1,
		},
		title: {
			type: "string",
			title: "Header Title",
			description: "Header text shown above the event list (default: 'Upcoming Events')",
			maxLength: 200,
			default: "Upcoming Events",
		},
		maxEvents: {
			type: "integer",
			title: "Max Events",
			description: "Maximum number of events to display (default: 10)",
			minimum: 1,
			maximum: 50,
			default: 10,
		},
		parseMode: {
			type: "string",
			enum: ["Markdown", "HTML", "MarkdownV2"],
			description: "Parse mode for messages (default: HTML)",
			default: "HTML",
		},
		showCalendarTitle: {
			type: "boolean",
			title: "Show Calendar Title",
			description: "Show calendar name with eventky link above events (default: true)",
			default: true,
		},
		eventkyBaseUrl: {
			type: "string",
			title: "Eventky Base URL",
			description: "Base URL for eventky web app (default: https://app.eventky.com)",
			default: "https://app.eventky.com",
		},
		timelineOptions: {
			type: "array",
			title: "Timeline Options",
			description: "Which timeline filter options to offer",
			items: {
				type: "string",
				enum: ["week", "2weeks", "30days"],
			},
			default: ["week", "2weeks", "30days"],
		},
	},
	required: ["nexusUrl", "calendars"],
};

export const MEETUPS_DATASET_SCHEMAS: DatasetSchemas = {};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escape HTML special characters for safe embedding in HTML messages.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * Format an ISO 8601 datetime string for display.
 * Returns a human-readable date/time string.
 */
export function formatEventDate(dtstart: string, dtend?: string): string {
	try {
		const start = new Date(dtstart);
		const dateStr = start.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
		const timeStr = start.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

		let result = `${dateStr}, ${timeStr}`;

		if (dtend) {
			const end = new Date(dtend);
			const sameDay = start.toDateString() === end.toDateString();
			if (sameDay) {
				const endTime = end.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});
				result += `\u2013${endTime}`;
			} else {
				const endDateStr = end.toLocaleDateString("en-US", {
					weekday: "short",
					month: "short",
					day: "numeric",
				});
				const endTime = end.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});
				result += ` \u2013 ${endDateStr}, ${endTime}`;
			}
		}

		return result;
	} catch {
		return dtstart;
	}
}

/**
 * Format a list of events as an HTML message.
 */
export function formatEventsMessage(
	events: NexusEvent[],
	title: string,
): string {
	if (events.length === 0) {
		return `<b>${escapeHtml(title)}</b>\n\nNo upcoming events found.`;
	}

	let text = `<b>${escapeHtml(title)}</b>\n`;

	for (const event of events) {
		const date = formatEventDate(event.dtstart, event.dtend);
		text += `\n<b>${escapeHtml(event.summary)}</b>\n`;
		text += `${escapeHtml(date)}\n`;
		if (event.description) {
			const desc = event.description.length > 100
				? event.description.slice(0, 97) + "..."
				: event.description;
			text += `${escapeHtml(desc)}\n`;
		}
	}

	return text;
}

/**
 * Compute end date as Unix microseconds for a given timeline range.
 */
export function computeEndDate(rangeId: TimelineRangeId): number {
	const now = new Date();

	switch (rangeId) {
		case "week": {
			// End of current week (Sunday 23:59:59)
			const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
			const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
			const endOfWeek = new Date(now);
			endOfWeek.setDate(now.getDate() + daysUntilSunday);
			endOfWeek.setHours(23, 59, 59, 999);
			return endOfWeek.getTime() * 1000;
		}
		case "2weeks": {
			const twoWeeks = new Date(now);
			twoWeeks.setDate(now.getDate() + 14);
			twoWeeks.setHours(23, 59, 59, 999);
			return twoWeeks.getTime() * 1000;
		}
		case "30days": {
			const thirtyDays = new Date(now);
			thirtyDays.setDate(now.getDate() + 30);
			thirtyDays.setHours(23, 59, 59, 999);
			return thirtyDays.getTime() * 1000;
		}
	}
}

/**
 * Extract pk and calendarId from a pubky:// calendar URI and build an eventky web link.
 * URI format: pubky://<pk>/pub/eventky.app/calendars/<calendarId>
 */
export function buildEventkyCalendarUrl(calUri: string, baseUrl: string): string {
	const match = /^pubky:\/\/([^/]+)\/pub\/eventky\.app\/calendars\/([^/]+)/.exec(calUri);
	if (!match) return "";
	const [, pk, calendarId] = match;
	return `${baseUrl.replace(/\/$/, "")}/calendars/${pk}/${calendarId}`;
}

/**
 * Build an HTML header with the calendar title and optional eventky link.
 * Returns empty string if showCalendarTitle is disabled.
 */
export function buildCalendarHeader(
	config: MeetupsConfig,
	selectedCalendar: number | "all",
): string {
	if (config.showCalendarTitle === false) return "";
	const baseUrl = config.eventkyBaseUrl || "https://app.eventky.com";

	if (selectedCalendar === "all") {
		return `<b>${escapeHtml(config.title || "Upcoming Events")}</b>\n\n`;
	}

	const cal = config.calendars[selectedCalendar];
	if (!cal) return "";

	const name = escapeHtml(cal.name || config.title || "Upcoming Events");
	const url = buildEventkyCalendarUrl(cal.uri, baseUrl);

	if (url) {
		return `<b><a href="${url}">${name}</a></b>\n\n`;
	}
	return `<b>${name}</b>\n\n`;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: Partial<MeetupsConfig> = {
	title: "Upcoming Events",
	maxEvents: 10,
	parseMode: "HTML",
	showCalendarTitle: true,
	eventkyBaseUrl: "https://app.eventky.com",
	timelineOptions: ["week", "2weeks", "30days"],
};
