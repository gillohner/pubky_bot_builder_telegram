// packages/core_services/event-creator/utils/calendar.ts
// Calendar configuration utilities

import type { CalendarOption, EventCreatorConfig, EventCreatorState } from "../types.ts";

/**
 * Get the default calendar URI from config
 * Returns legacy calendarUri or the calendar marked as default in calendars array
 */
export function getDefaultCalendarUri(config: EventCreatorConfig): string | undefined {
	// Legacy single calendar mode
	if (config.calendarUri) {
		return config.calendarUri;
	}

	// New multi-calendar mode - find default
	if (config.calendars && config.calendars.length > 0) {
		const defaultCal = config.calendars.find((c) => c.isDefault);
		if (defaultCal) return defaultCal.uri;

		// If no explicit default, use first calendar
		return config.calendars[0].uri;
	}

	// Explicit defaultCalendar fallback
	return config.defaultCalendar;
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
	// Check in calendars array
	if (config.calendars) {
		const cal = config.calendars.find((c) => c.uri === uri);
		if (cal) return cal.name;
	}

	// Fallback to extracting ID from URI
	const parts = uri.split("/");
	return parts[parts.length - 1] || uri;
}

/**
 * Get non-default calendars for selection menu
 */
export function getSelectableCalendars(config: EventCreatorConfig): CalendarOption[] {
	if (!config.calendars || config.calendars.length <= 1) {
		return [];
	}

	const defaultUri = getDefaultCalendarUri(config);
	return config.calendars.filter((c) => c.uri !== defaultUri);
}

/**
 * Check if calendar selection is enabled (multiple calendars configured)
 */
export function isCalendarSelectionEnabled(config: EventCreatorConfig): boolean {
	return !!config.calendars && config.calendars.length > 1;
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
	if (config.calendars) {
		const cal = config.calendars.find((c) => c.uri.endsWith("/" + id) || c.uri === id);
		return cal?.uri;
	}
	return undefined;
}
