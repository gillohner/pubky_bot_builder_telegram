// packages/core_services/event-creator/flows/optional_menu.ts
// Optional menu display and field addition handlers

import {
	type CallbackEvent,
	type MessageEvent,
	reply,
	state,
	UIBuilder,
	uiKeyboard,
} from "@sdk/mod.ts";
import { SERVICE_ID } from "../constants.ts";
import type { EventCreatorConfig, EventCreatorState } from "../types.ts";
import { isCalendarSelectionEnabled } from "../utils/calendar.ts";
import { buildEventSummary } from "../utils/preview.ts";
import { validateDescription, validateLocationName } from "../utils/validation.ts";

export function showOptionalMenu(st: EventCreatorState, ev: CallbackEvent | MessageEvent) {
	const config = (ev.serviceConfig ?? {}) as EventCreatorConfig;

	const reqMark = (field: string) => {
		const map: Record<string, keyof typeof config> = {
			location: "requireLocation",
			image: "requireImage",
			endtime: "requireEndTime",
		};
		const key = map[field];
		return key && config[key] ? " *" : "";
	};

	const keyboard = UIBuilder.keyboard()
		.namespace(SERVICE_ID)
		.callback(`📝 Add/Edit Description`, "menu:description")
		.row()
		.callback(`🖼️ Add/Edit Image${reqMark("image")}`, "menu:image")
		.row()
		.callback(`📍 Add/Edit Location${reqMark("location")}`, "menu:location")
		.row()
		.callback(`⏰ Add/Edit End Time${reqMark("endtime")}`, "menu:endtime")
		.row();

	// Show calendar selector only if multiple calendars configured
	if (isCalendarSelectionEnabled(config)) {
		keyboard.callback("📅 Select Calendars", "menu:calendars").row();
	}

	keyboard
		.callback("✏️ Edit Required Fields", "menu:edit")
		.row()
		.callback("✅ Submit Event", "menu:submit", "primary")
		.callback("❌ Cancel", "menu:cancel", "danger");

	const summary = buildEventSummary(st, config);
	const message = `${summary}\n\n**What would you like to do?**`;

	return uiKeyboard(keyboard.build(), message, {
		state: state.replace(st),
	});
}

export function handleOptionalMenuAction(
	ev: CallbackEvent | MessageEvent,
	action: string,
) {
	const st = (ev.state ?? {}) as EventCreatorState;

	switch (action) {
		case "description":
			return reply(
				"📝 **Add Description**\n\n" +
					'Enter a description for your event (or type "skip" to cancel):',
				{
					state: state.merge({ waitingFor: "description" }),
				},
			);

		case "image":
			return reply(
				"🖼️ **Add Image**\n\n" +
					'Send a photo for your event (or type "skip" to cancel):',
				{
					state: state.merge({ waitingFor: "image" }),
				},
			);

		case "location":
			return reply(
				"📍 **Add Location**\n\n" +
					'Enter the location name or address (or type "skip" to cancel):',
				{
					state: state.merge({ waitingFor: "location" }),
				},
			);

		case "endtime":
			return reply(
				"⏰ **Add End Time**\n\n" +
					'First, enter the end date (DD.MM.YYYY) or type "skip" to cancel:',
				{
					state: state.merge({ waitingFor: "endDate" }),
				},
			);

		case "back":
			// Return to menu
			return showOptionalMenu(st, ev);

		default:
			return showOptionalMenu(st, ev);
	}
}

export function handleOptionalFieldInput(ev: MessageEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const message = ev.message as Record<string, unknown>;
	const text = (message.text as string)?.trim() ?? "";
	const waitingFor = (st as Record<string, unknown>).waitingFor as string | undefined;

	// Handle photo uploads
	if (message.photo && waitingFor === "image") {
		const photos = message.photo as Array<{ file_id: string }>;
		const fileId = photos[photos.length - 1]?.file_id;

		if (fileId) {
			const updatedState = {
				...st,
				imageFileId: fileId,
				waitingFor: undefined,
			};
			delete (updatedState as Record<string, unknown>).waitingFor;
			// Update state and show menu
			return showOptionalMenu(updatedState, ev);
		}
	}

	// Handle text input
	if (!waitingFor) {
		return showOptionalMenu(st, ev);
	}

	if (text.toLowerCase() === "skip") {
		const cleaned = { ...st };
		delete (cleaned as Record<string, unknown>).waitingFor;
		return showOptionalMenu(cleaned, ev);
	}

	switch (waitingFor) {
		case "description":
			return handleDescriptionInput(text, st, ev);

		case "location":
			return handleLocationInput(text, st, ev);

		case "endDate":
			return handleEndDateInput(text, st, ev);

		case "endTime":
			return handleEndTimeInput(text, st, ev);

		default:
			return showOptionalMenu(st, ev);
	}
}

function handleDescriptionInput(text: string, st: EventCreatorState, ev: MessageEvent) {
	const validation = validateDescription(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	const updatedState = {
		...st,
		description: text,
	};
	delete (updatedState as Record<string, unknown>).waitingFor;

	return showOptionalMenu(updatedState, ev);
}

function handleLocationInput(text: string, st: EventCreatorState, ev: MessageEvent) {
	const validation = validateLocationName(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	const updatedState = {
		...st,
		location: { name: text },
	};
	delete (updatedState as Record<string, unknown>).waitingFor;

	return showOptionalMenu(updatedState, ev);
}

async function handleEndDateInput(text: string, _st: EventCreatorState, _ev: MessageEvent) {
	// Import validation here to avoid circular deps
	const { normalizeDate, validateDate } = await import("../utils/validation.ts");
	const validation = validateDate(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	const normalized = normalizeDate(text) ?? text;

	return reply(
		`✅ End date: **${normalized}**\n\n` +
			`Now enter the end time (HH:MM):`,
		{
			state: state.merge({
				endDate: normalized,
				waitingFor: "endTime",
			}),
		},
	);
}

async function handleEndTimeInput(text: string, st: EventCreatorState, ev: MessageEvent) {
	const { validateTime, validateEndTime } = await import("../utils/validation.ts");

	const timeValidation = validateTime(text);
	if (!timeValidation.valid) {
		return reply(timeValidation.error!);
	}

	// Validate end is after start
	const endValidation = validateEndTime(
		st.startDate!,
		st.startTime!,
		st.endDate!,
		text,
	);
	if (!endValidation.valid) {
		return reply(endValidation.error!);
	}

	const updatedState = {
		...st,
		endTime: text,
	};
	delete (updatedState as Record<string, unknown>).waitingFor;

	return showOptionalMenu(updatedState, ev);
}
