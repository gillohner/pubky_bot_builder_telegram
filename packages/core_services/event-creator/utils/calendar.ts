// packages/core_services/event-creator/utils/calendar.ts
// Calendar configuration utilities

import type { CalendarOption, EventCreatorConfig, EventCreatorState } from "../types.ts";

/**
 * Normalize calendars array to CalendarOption[].
 * Config may store calendars as plain URI strings or as CalendarOption objects.
 */
function normalizeCalendars(calendars: unknown[]): CalendarOption[] {
	return calendars.map((c, i) => {
		if (typeof c === "string") {
			// Plain URI string — first item is default
			const parts = c.split("/");
			return {
				uri: c,
				name: parts[parts.length - 1] || c,
				isDefault: i === 0,
			};
		}
		return c as CalendarOption;
	});
}

/**
 * Get normalized calendars from config, handling both string[] and CalendarOption[] formats
 */
export function getCalendars(config: EventCreatorConfig): CalendarOption[] {
	if (!config.calendars || config.calendars.length === 0) {
		return [];
	}
	return normalizeCalendars(config.calendars as unknown[]);
}

/**
 * Get the default calendar URI from config
 * Returns the calendar marked as default, or the first calendar in the array
 */
export function getDefaultCalendarUri(config: EventCreatorConfig): string | undefined {
	const calendars = getCalendars(config);
	if (calendars.length === 0) {
		return undefined;
	}

	const defaultCal = calendars.find((c) => c.isDefault);
	if (defaultCal) return defaultCal.uri;

	// If no explicit default, use first calendar
	return calendars[0].uri;
}

/**
 * Get all calendar URIs for the event (default + selected)
 */
export function getAllCalendarUris(
	state: EventCreatorState,
	config: EventCreatorConfig,
): string[] {
	const uris: string[] = [];

	// Always include default
	const defaultUri = getDefaultCalendarUri(config);
	if (defaultUri) {
		uris.push(defaultUri);
	}

	// Add selected additional calendars
	if (state.selectedCalendars) {
		uris.push(...state.selectedCalendars);
	}

	// Remove duplicates
	return [...new Set(uris)];
}

/**
 * Get display name for a calendar URI
 */
export function getCalendarName(uri: string, config: EventCreatorConfig): string {
	const calendars = getCalendars(config);
	const cal = calendars.find((c) => c.uri === uri);
	if (cal?.name) return cal.name;

	// Fallback to extracting ID from URI
	const parts = uri.split("/");
	return parts[parts.length - 1] || uri;
}

/**
 * Get non-default calendars for selection menu
 */
export function getSelectableCalendars(config: EventCreatorConfig): CalendarOption[] {
	const calendars = getCalendars(config);
	if (calendars.length <= 1) {
		return [];
	}

	const defaultUri = getDefaultCalendarUri(config);
	return calendars.filter((c) => c.uri !== defaultUri);
}

/**
 * Check if calendar selection is enabled (multiple calendars configured)
 */
export function isCalendarSelectionEnabled(config: EventCreatorConfig): boolean {
	return getCalendars(config).length > 1;
}

/**
 * Encode calendar URI for callback data (truncate to last segment)
 */
export function encodeCalendarId(uri: string): string {
	const parts = uri.split("/");
	return parts[parts.length - 1] || uri;
}

/**
 * Decode calendar ID from callback data back to full URI
 */
export function decodeCalendarId(id: string, config: EventCreatorConfig): string | undefined {
	const calendars = getCalendars(config);
	const cal = calendars.find((c) => c.uri.endsWith("/" + id) || c.uri === id);
	return cal?.uri;
}
