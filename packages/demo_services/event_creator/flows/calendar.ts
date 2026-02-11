// packages/demo_services/event_creator/flows/calendar.ts
// Calendar selection and toggle handlers

import { type CallbackEvent, reply, state, UIBuilder, uiKeyboard } from "@sdk/mod.ts";
import { SERVICE_ID } from "../constants.ts";
import type { EventCreatorConfig, EventCreatorState } from "../types.ts";
import { decodeCalendarId, encodeCalendarId, getSelectableCalendars } from "../utils/calendar.ts";

export function handleCalendarMenu(ev: CallbackEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const config = (ev.serviceConfig ?? {}) as EventCreatorConfig;

	const selectableCalendars = getSelectableCalendars(config);
	if (selectableCalendars.length === 0) {
		return reply("No additional calendars available.", {
			state: state.replace(st),
		});
	}

	const selected = st.selectedCalendars || [];
	const keyboard = UIBuilder.keyboard().namespace(SERVICE_ID);

	for (const cal of selectableCalendars) {
		const isSelected = selected.includes(cal.uri);
		const icon = isSelected ? "✅" : "☐";
		const calId = encodeCalendarId(cal.uri);
		keyboard.callback(
			`${icon} ${cal.name}`,
			`calendar:toggle:${calId}`,
		).row();
	}

	keyboard.callback("← Back to Menu", "calendar:back");

	const message = `📅 **Select Additional Calendars**\n\n` +
		`Tap to toggle calendar selection. Selected calendars will receive this event.\n\n` +
		`Currently selected: ${selected.length}`;

	return reply(message, {
		...uiKeyboard(keyboard.build(), message),
		state: state.replace(st),
	});
}

export function handleCalendarToggle(ev: CallbackEvent, calIdEncoded: string) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const config = (ev.serviceConfig ?? {}) as EventCreatorConfig;

	// Remove "toggle:" prefix if present
	const calId = calIdEncoded.replace("toggle:", "");
	const calUri = decodeCalendarId(calId, config);

	if (!calUri) {
		return reply("Calendar not found.", {
			state: state.replace(st),
		});
	}

	let selected = st.selectedCalendars || [];

	if (selected.includes(calUri)) {
		// Remove
		selected = selected.filter((uri) => uri !== calUri);
	} else {
		// Add
		selected = [...selected, calUri];
	}

	const updatedState = {
		...st,
		selectedCalendars: selected,
	};

	// Redisplay calendar menu with updated selection
	return handleCalendarMenu({
		...ev,
		state: updatedState,
	});
}
