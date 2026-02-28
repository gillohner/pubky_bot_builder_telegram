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
import { MENU_REPLACE_GROUP, SERVICE_ID } from "../constants.ts";
import type { EventCreatorConfig, EventCreatorState } from "../types.ts";
import { isCalendarSelectionEnabled } from "../utils/calendar.ts";
import { buildEventSummary } from "../utils/preview.ts";
import {
	normalizeDate,
	parseDateParts,
	validateDate,
	validateDescription,
	validateEndTime,
	validateLocationName,
	validateTime,
} from "../utils/validation.ts";
import {
	handleLocationSearchInput,
	handleOnlineUrlInput,
	showLocationTypeMenu,
} from "./location.ts";

export function showOptionalMenu(
	st: EventCreatorState,
	ev: CallbackEvent | MessageEvent,
	extraOpts?: Record<string, unknown>,
) {
	const config = (ev.serviceConfig ?? {}) as EventCreatorConfig;

	const reqMark = (field: string) => {
		const map: Record<string, keyof typeof config> = {
			location: "requireLocation",
			image: "requireImage",
			endtime: "requireEndTime",
		};
		const key = map[field];
		return key && config[key] ? " ❗" : "";
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
	const message = `${summary}\n\n*What would you like to do?*`;

	return uiKeyboard(keyboard.build(), message, {
		state: state.replace(st),
		options: { ...extraOpts, replaceGroup: MENU_REPLACE_GROUP },
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
				"📝 *Add Description*\n\n" +
					'Enter a description for your event (or type "skip" to cancel):',
				{
					state: state.merge({ waitingFor: "description" }),
					options: { cleanupGroup: MENU_REPLACE_GROUP },
				},
			);

		case "image":
			return reply(
				"🖼️ *Add Image*\n\n" +
					'Send a photo for your event (or type "skip" to cancel):',
				{
					state: state.merge({ waitingFor: "image" }),
					options: { cleanupGroup: MENU_REPLACE_GROUP },
				},
			);

		case "location":
			return showLocationTypeMenu(st);

		case "endtime":
			return reply(
				"⏰ *Add End Time*\n\n" +
					'First, enter the end date (DD.MM.YYYY) or type "skip" to cancel:',
				{
					state: state.merge({ waitingFor: "endDate" }),
					options: { cleanupGroup: MENU_REPLACE_GROUP },
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

	// Handle photo/document uploads
	if (waitingFor === "image") {
		let fileId: string | undefined;

		if (message.photo) {
			// Compressed image sent as photo
			const photos = message.photo as Array<{ file_id: string }>;
			fileId = photos[photos.length - 1]?.file_id;
		} else if (message.document) {
			// Uncompressed image sent as document/file
			const doc = message.document as { file_id: string; mime_type?: string };
			if (doc.mime_type?.startsWith("image/")) {
				fileId = doc.file_id;
			}
		}

		if (fileId) {
			const updatedState = {
				...st,
				imageFileId: fileId,
				waitingFor: undefined,
			};
			delete (updatedState as Record<string, unknown>).waitingFor;
			return showOptionalMenu(updatedState, ev);
		}

		// If document is not an image, tell the user
		if (message.document) {
			return reply("Please send an image file (JPEG, PNG, etc.), not other file types.");
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

		case "location_search":
			return handleLocationSearchInput(text, st, ev);

		case "location_online_url":
			return handleOnlineUrlInput(text, st, ev);

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

function handleEndDateInput(text: string, st: EventCreatorState, _ev: MessageEvent) {
	const validation = validateDate(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	const normalized = normalizeDate(text) ?? text;

	// Validate end date is not before start date
	if (st.startDate) {
		const startParts = parseDateParts(st.startDate);
		const endParts = parseDateParts(normalized);
		if (startParts && endParts) {
			const startVal = startParts.year * 10000 + startParts.month * 100 + startParts.day;
			const endVal = endParts.year * 10000 + endParts.month * 100 + endParts.day;
			if (endVal < startVal) {
				return reply(
					`End date (${normalized}) is before the start date (${st.startDate}).\n\n` +
						`Please enter an end date on or after the start date:`,
				);
			}
		}
	}

	return reply(
		`✅ End date: *${normalized}*\n\n` +
			`Now enter the end time (HH:MM):`,
		{
			state: state.merge({
				endDate: normalized,
				waitingFor: "endTime",
			}),
		},
	);
}

function handleEndTimeInput(text: string, st: EventCreatorState, ev: MessageEvent) {
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
