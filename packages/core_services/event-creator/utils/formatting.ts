// packages/core_services/event-creator/utils/formatting.ts
// Date/time and URL formatting utilities

import { EVENTKY_APP_BASE } from "../constants.ts";

/**
 * Format date and time into ISO datetime string
 * Example: formatDateTime("2026-04-11", "18:00") => "2026-04-11T18:00:00"
 */
export function formatDateTime(date: string, time: string): string {
	return `${date}T${time}:00`;
}

/**
 * Build eventky.app URL for a specific event
 * Format: https://eventky.app/event/{userId}/{eventId}?instance={dtstart}
 */
export function buildEventUrl(
	userId: string,
	eventId: string,
	dtstart: string,
): string {
	const instanceParam = encodeURIComponent(dtstart);
	return `${EVENTKY_APP_BASE}/event/${userId}/${eventId}?instance=${instanceParam}`;
}

/**
 * Apply template variable replacements
 * Supported variables: {url}, {title}, {date}, {time}
 */
export function applyTemplate(
	template: string,
	vars: {
		url: string;
		title: string;
		date: string;
		time: string;
	},
): string {
	return template
		.replace(/{url}/g, vars.url)
		.replace(/{title}/g, vars.title)
		.replace(/{date}/g, vars.date)
		.replace(/{time}/g, vars.time);
}

/**
 * Truncate text for display
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format a date for display (YYYY-MM-DD => Month DD, YYYY)
 */
export function formatDateDisplay(date: string): string {
	const d = new Date(date);
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
