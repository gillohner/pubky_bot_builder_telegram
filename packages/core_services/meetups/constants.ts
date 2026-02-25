// packages/core_services/meetups/constants.ts
// Meetups - Single command service that displays upcoming events from Pubky calendars

import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

// ============================================================================
// Service Identity
// ============================================================================

export const MEETUPS_SERVICE_ID = "meetups" as const;
export const MEETUPS_VERSION = "1.0.0" as const;

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
	/** Parse mode (default: "Markdown") */
	parseMode?: "Markdown" | "HTML" | "MarkdownV2";
}

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
		},
		maxEvents: {
			type: "integer",
			title: "Max Events",
			description: "Maximum number of events to display (default: 10)",
			minimum: 1,
			maximum: 50,
		},
		parseMode: {
			type: "string",
			enum: ["Markdown", "HTML", "MarkdownV2"],
			description: "Parse mode for messages (default: Markdown)",
		},
	},
	required: ["nexusUrl", "calendars"],
};

export const MEETUPS_DATASET_SCHEMAS: DatasetSchemas = {};

// ============================================================================
// Helpers
// ============================================================================

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
				result += `–${endTime}`;
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
				result += ` – ${endDateStr}, ${endTime}`;
			}
		}

		return result;
	} catch {
		return dtstart;
	}
}

/**
 * Format a list of events as a Markdown message.
 */
export function formatEventsMessage(
	events: NexusEvent[],
	title: string,
): string {
	if (events.length === 0) {
		return `*${title}*\n\nNo upcoming events found.`;
	}

	let text = `*${title}*\n`;

	for (const event of events) {
		const date = formatEventDate(event.dtstart, event.dtend);
		text += `\n*${event.summary}*\n`;
		text += `${date}\n`;
		if (event.description) {
			// Truncate long descriptions
			const desc = event.description.length > 100
				? event.description.slice(0, 97) + "..."
				: event.description;
			text += `${desc}\n`;
		}
	}

	return text;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: Partial<MeetupsConfig> = {
	title: "Upcoming Events",
	maxEvents: 10,
	parseMode: "Markdown",
};
