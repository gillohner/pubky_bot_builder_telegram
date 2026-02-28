// packages/core_services/event-creator/flows/edit.ts
// Field editing handlers

import {
	type CallbackEvent,
	type MessageEvent,
	reply,
	state,
	UIBuilder,
	uiKeyboard,
} from "@sdk/mod.ts";
import { SERVICE_ID } from "../constants.ts";
import type { EventCreatorState } from "../types.ts";
import { escapeHtml } from "../utils/formatting.ts";
import { getEditPrompt, isFieldClearable } from "../utils/state.ts";
import {
	normalizeDate,
	parseDateParts,
	validateDate,
	validateDescription,
	validateEndTime,
	validateLocationName,
	validateTime,
	validateTitle,
} from "../utils/validation.ts";
import { showOptionalMenu } from "./optional_menu.ts";

export function handleEditMenu(ev: CallbackEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;

	const keyboard = UIBuilder.keyboard()
		.namespace(SERVICE_ID)
		.callback(`📌 Title: ${st.title}`, "edit:title")
		.row()
		.callback(`📅 Date: ${st.startDate}`, "edit:startDate")
		.row()
		.callback(`⏰ Time: ${st.startTime}`, "edit:startTime")
		.row();

	if (st.description) {
		keyboard.callback(`📝 Description: ${st.description.substring(0, 20)}...`, "edit:description")
			.row();
	}
	if (st.location?.name) {
		keyboard.callback(`📍 Location: ${st.location.name.substring(0, 20)}...`, "edit:location")
			.row();
	}
	if (st.endDate && st.endTime) {
		keyboard.callback(`⏱️ End: ${st.endDate} ${st.endTime}`, "edit:endTime").row();
	}
	if (st.imageFileId) {
		keyboard.callback("🖼️ Image: Attached", "edit:imageFileId").row();
	}

	keyboard.callback("← Back to Menu", "edit:back");

	const message = `✏️ <b>Edit Fields</b>\n\nSelect a field to edit:`;

	return uiKeyboard(keyboard.build(), message, {
		state: state.replace(st),
	});
}

export function handleEditField(_ev: CallbackEvent, field: string) {
	const prompt = getEditPrompt(field);

	return reply(prompt, {
		state: state.merge({
			phase: "editing",
			editingField: field,
		}),
	});
}

export function handleEditFieldInput(ev: MessageEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const message = ev.message as Record<string, unknown>;
	const text = (message.text as string)?.trim() ?? "";
	const field = st.editingField;

	if (!field) {
		return showOptionalMenu(st, ev);
	}

	// Handle photo/document for image field
	if (field === "imageFileId") {
		let fileId: string | undefined;

		if (message.photo) {
			const photos = message.photo as Array<{ file_id: string }>;
			fileId = photos[photos.length - 1]?.file_id;
		} else if (message.document) {
			const doc = message.document as { file_id: string; mime_type?: string };
			if (doc.mime_type?.startsWith("image/")) {
				fileId = doc.file_id;
			}
		}

		if (fileId) {
			const updatedState = {
				...st,
				imageFileId: fileId,
				phase: "optional_menu" as const,
				editingField: undefined,
			};
			return showOptionalMenu(updatedState, ev);
		}

		if (message.document) {
			return reply("Please send an image file (JPEG, PNG, etc.), not other file types.");
		}
	}

	// Handle "clear" for optional fields
	if (text.toLowerCase() === "clear" && isFieldClearable(field)) {
		const updatedState = { ...st };
		if (field === "description") updatedState.description = undefined;
		if (field === "location") updatedState.location = undefined;
		if (field === "imageFileId") updatedState.imageFileId = undefined;
		if (field === "endTime" || field === "endDate") {
			updatedState.endDate = undefined;
			updatedState.endTime = undefined;
		}
		updatedState.phase = "optional_menu";
		updatedState.editingField = undefined;

		return showOptionalMenu(updatedState, ev);
	}

	// Validate and update field
	return validateAndUpdateField(field, text, st, ev);
}

function validateAndUpdateField(
	field: string,
	text: string,
	st: EventCreatorState,
	ev: MessageEvent,
) {
	let validation: { valid: boolean; error?: string } = { valid: true };
	const updatedState = { ...st };

	switch (field) {
		case "title":
			validation = validateTitle(text);
			if (validation.valid) updatedState.title = text;
			break;

		case "startDate":
			validation = validateDate(text);
			if (validation.valid) updatedState.startDate = normalizeDate(text) ?? text;
			break;

		case "startTime":
			validation = validateTime(text);
			if (validation.valid) updatedState.startTime = text;
			break;

		case "description":
			validation = validateDescription(text);
			if (validation.valid) updatedState.description = text;
			break;

		case "location":
			validation = validateLocationName(text);
			if (validation.valid) updatedState.location = { name: text };
			break;

		case "endDate":
			validation = validateDate(text);
			if (validation.valid) {
				const normalizedEnd = normalizeDate(text) ?? text;
				// Validate end date is not before start date
				if (st.startDate) {
					const startParts = parseDateParts(st.startDate);
					const endParts = parseDateParts(normalizedEnd);
					if (startParts && endParts) {
						const startVal = startParts.year * 10000 + startParts.month * 100 +
							startParts.day;
						const endVal = endParts.year * 10000 + endParts.month * 100 + endParts.day;
						if (endVal < startVal) {
							return reply(
								`End date (${normalizedEnd}) is before the start date (${st.startDate}).\n\n` +
									`Please enter an end date on or after the start date:`,
							);
						}
					}
				}
				updatedState.endDate = normalizedEnd;
				// Prompt for endTime if not set
				if (!st.endTime) {
					return reply(
						`✅ End date: <b>${escapeHtml(normalizedEnd)}</b>\n\n` +
							`Now enter the end time (HH:MM):`,
						{
							state: state.merge({
								endDate: normalizedEnd,
								editingField: "endTime",
							}),
							options: { parse_mode: "HTML" },
						},
					);
				}
			}
			break;

		case "endTime":
			validation = validateTime(text);
			if (validation.valid) {
				// Also validate end is after start
				const endValidation = validateEndTime(
					st.startDate!,
					st.startTime!,
					st.endDate || st.startDate!,
					text,
				);
				if (!endValidation.valid) {
					return reply(endValidation.error!);
				}
				updatedState.endTime = text;
			}
			break;

		default:
			return reply("Unknown field.", {
				state: state.replace({ ...st, phase: "optional_menu", editingField: undefined }),
			});
	}

	if (!validation.valid) {
		return reply(validation.error!);
	}

	updatedState.phase = "optional_menu";
	updatedState.editingField = undefined;

	return showOptionalMenu(updatedState, ev);
}
