// packages/core_services/event-creator/utils/preview.ts
// Preview generation for admin approval

import type { PubkyAppEvent } from "@eventky/mod.ts";
import type { EventCreatorConfig, EventCreatorState } from "../types.ts";
import { truncate } from "./formatting.ts";
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
		`📅 **${event.summary}**`,
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
		lines.push(`📍 ${state.location.name}`);
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
		return key && config[key] ? " *" : "";
	};

	const lines: string[] = [
		`📋 **Event Summary**\n`,
		`📌 **Title:** ${state.title}`,
		`📅 **Date:** ${state.startDate}`,
		`⏰ **Time:** ${state.startTime}`,
	];

	// Optional fields
	if (state.description) {
		lines.push(`📝 **Description:** ${truncate(state.description, 100)}`);
	} else {
		lines.push(`📝 **Description:** _(not set)_`);
	}

	if (state.endDate && state.endTime) {
		lines.push(`⏱️ **End${req("endTime")}:** ${state.endDate} at ${state.endTime}`);
	} else {
		lines.push(`⏱️ **End${req("endTime")}:** _(not set)_`);
	}

	if (state.location?.name) {
		lines.push(`📍 **Location${req("location")}:** ${truncate(state.location.name, 50)}`);
	} else {
		lines.push(`📍 **Location${req("location")}:** _(not set)_`);
	}

	if (state.imageFileId) {
		lines.push(`🖼️ **Image${req("image")}:** ✅ Attached`);
	} else {
		lines.push(`🖼️ **Image${req("image")}:** _(not set)_`);
	}

	// Calendar status
	const calendars = getAllCalendarUris(state, config);
	if (calendars.length > 0) {
		const calNames = calendars.map((uri) => getCalendarName(uri, config));
		lines.push(`\n📋 **Calendars:** ${calNames.join(", ")}`);
	}

	return lines.join("\n");
}
