// packages/demo_services/event_creator/handlers/callback.ts
// Callback handler router for optional menu and calendar selection

import { type CallbackEvent, reply, state } from "@sdk/mod.ts";
import { CB_CALENDAR_PREFIX, CB_EDIT_PREFIX, CB_MENU_PREFIX } from "../constants.ts";
import { handleCalendarToggle, handleCalendarMenu } from "../flows/calendar.ts";
import { handleEditField, handleEditMenu } from "../flows/edit.ts";
import { handleOptionalMenuAction } from "../flows/optional_menu.ts";
import { handleSubmit } from "../flows/submit.ts";

export function handleCallback(ev: CallbackEvent) {
	const data = ev.data ?? "";

	// Route to appropriate handler
	if (data.startsWith(CB_MENU_PREFIX)) {
		return handleMenuCallback(ev, data);
	}

	if (data.startsWith(CB_CALENDAR_PREFIX)) {
		return handleCalendarCallback(ev, data);
	}

	if (data.startsWith(CB_EDIT_PREFIX)) {
		return handleEditCallback(ev, data);
	}

	return reply("Unknown action. Please start over.", {
		state: state.clear(),
	});
}

function handleMenuCallback(ev: CallbackEvent, data: string) {
	const action = data.substring(CB_MENU_PREFIX.length);

	switch (action) {
		case "description":
		case "image":
		case "location":
		case "endtime":
			return handleOptionalMenuAction(ev, action);

		case "calendars":
			return handleCalendarMenu(ev);

		case "edit":
			return handleEditMenu(ev);

		case "submit":
			return handleSubmit(ev);

		case "cancel":
			return reply("❌ Event creation cancelled.", {
				state: state.clear(),
				deleteTrigger: true,
			});

		default:
			return reply("Unknown menu action.", { state: state.clear() });
	}
}

function handleCalendarCallback(ev: CallbackEvent, data: string) {
	const action = data.substring(CB_CALENDAR_PREFIX.length);

	if (action === "back") {
		// Return to optional menu
		return handleOptionalMenuAction(ev, "back");
	}

	// Toggle calendar selection
	return handleCalendarToggle(ev, action);
}

function handleEditCallback(ev: CallbackEvent, data: string) {
	const field = data.substring(CB_EDIT_PREFIX.length);

	if (field === "back") {
		// Return to optional menu
		return handleOptionalMenuAction(ev, "back");
	}

	return handleEditField(ev, field);
}
