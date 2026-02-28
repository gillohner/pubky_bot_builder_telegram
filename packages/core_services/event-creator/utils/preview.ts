// packages/core_services/event-creator/utils/preview.ts
// Preview generation for admin approval

import type { PubkyAppEvent } from "@eventky/mod.ts";
import type { EventCreatorConfig, EventCreatorState } from "../types.ts";
import { escapeHtml, truncate } from "./formatting.ts";
import { getAllCalendarUris, getCalendarName } from "./calendar.ts";

/**
 * Build admin preview message for approval flow
 */
export function buildAdminPreview(
	event: PubkyAppEvent,
	state: EventCreatorState,
	config: EventCreatorConfig,
): string {
	const lines: string[] = [
		`📅 *${event.summary}*`,
	];

	if (event.description) {
		lines.push(`\n${truncate(event.description, 200)}`);
	}

	lines.push(`\n📆 ${state.startDate} at ${state.startTime}`);

	if (state.endDate && state.endTime) {
		lines.push(`⏰ Until ${state.endDate} at ${state.endTime}`);
	}

	if (event.dtstart_tzid) {
		lines.push(`🌍 ${event.dtstart_tzid}`);
	}

	if (state.location?.name) {
		const icon = state.location.location_type === "ONLINE" ? "💻" : "📍";
		lines.push(`${icon} ${state.location.name}`);
		if (state.location.structured_data) {
			lines.push(`   🔗 ${state.location.structured_data}`);
		}
	}

	if (state.imageFileId) {
		lines.push(`🖼️ Image: Included`);
	}

	// Calendar list
	const calendars = getAllCalendarUris(state, config);
	if (calendars.length > 0) {
		lines.push(`\n📋 Calendars:`);
		for (const uri of calendars) {
			const name = getCalendarName(uri, config);
			lines.push(`  • ${name}`);
		}
	}

	return lines.join("\n");
}

/**
 * Build event summary for optional menu display
 */
export function buildEventSummary(
	state: EventCreatorState,
	config: EventCreatorConfig,
): string {
	const req = (field: string) => {
		const map: Record<string, keyof EventCreatorConfig> = {
			location: "requireLocation",
			image: "requireImage",
			endTime: "requireEndTime",
		};
		const key = map[field];
		return key && config[key] ? " ❗" : "";
	};

	const lines: string[] = [
		`📋 <b>Event Summary</b>\n`,
		`📌 <b>Title:</b> ${escapeHtml(state.title || "")}`,
		`📅 <b>Date:</b> ${escapeHtml(state.startDate || "")}`,
		`⏰ <b>Time:</b> ${escapeHtml(state.startTime || "")}`,
	];

	// Optional fields
	if (state.description) {
		lines.push(`📝 <b>Description:</b> ${escapeHtml(truncate(state.description, 100))}`);
	} else {
		lines.push(`📝 <b>Description:</b> <i>(not set)</i>`);
	}

	if (state.endDate && state.endTime) {
		lines.push(
			`⏱️ <b>End${req("endTime")}:</b> ${escapeHtml(state.endDate)} at ${
				escapeHtml(state.endTime)
			}`,
		);
	} else {
		lines.push(`⏱️ <b>End${req("endTime")}:</b> <i>(not set)</i>`);
	}

	if (state.location?.name) {
		const icon = state.location.location_type === "ONLINE" ? "💻" : "📍";
		const locText = state.location.location_type === "ONLINE"
			? state.location.structured_data || state.location.name
			: truncate(state.location.name, 50);
		lines.push(`${icon} <b>Location${req("location")}:</b> ${escapeHtml(locText)}`);
	} else {
		lines.push(`📍 <b>Location${req("location")}:</b> <i>(not set)</i>`);
	}

	if (state.imageFileId) {
		lines.push(`🖼️ <b>Image${req("image")}:</b> ✅ Attached`);
	} else {
		lines.push(`🖼️ <b>Image${req("image")}:</b> <i>(not set)</i>`);
	}

	// Calendar status
	const calendars = getAllCalendarUris(state, config);
	if (calendars.length > 0) {
		const calNames = calendars.map((uri) => escapeHtml(getCalendarName(uri, config)));
		lines.push(`\n📋 <b>Calendars:</b> ${calNames.join(", ")}`);
	}

	return lines.join("\n");
}
