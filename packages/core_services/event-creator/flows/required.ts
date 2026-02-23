// packages/core_services/event-creator/flows/required.ts
// Required field collection flow (title, date, time)

import { type MessageEvent, reply, state } from "@sdk/mod.ts";
import { REQ_STEP_DATE, REQ_STEP_TIME, REQ_STEP_TITLE } from "../constants.ts";
import type { EventCreatorState } from "../types.ts";
import { normalizeDate, validateDate, validateTime, validateTitle } from "../utils/validation.ts";
import { showOptionalMenu } from "./optional_menu.ts";

export function handleRequiredFieldInput(ev: MessageEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const text = (ev.message as { text?: string })?.text?.trim() ?? "";
	const step = st.requirementStep ?? REQ_STEP_TITLE;

	switch (step) {
		case REQ_STEP_TITLE:
			return handleTitleInput(text, st);

		case REQ_STEP_DATE:
			return handleDateInput(text, st);

		case REQ_STEP_TIME:
			return handleTimeInput(text, st, ev);

		default:
			return reply("Something went wrong. Please start over with /newevent", {
				state: state.clear(),
			});
	}
}

function handleTitleInput(text: string, _st: EventCreatorState) {
	const validation = validateTitle(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	return reply(
		`✅ Title: **${text}**\n\n` +
			`📝 **Step 2/3**: When is the event? (DD.MM.YYYY)\n\n` +
			`Example: 23.04.2026`,
		{
			state: state.merge({
				requirementStep: REQ_STEP_DATE,
				title: text,
			}),
		},
	);
}

function handleDateInput(text: string, _st: EventCreatorState) {
	const validation = validateDate(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	const normalized = normalizeDate(text) ?? text;

	return reply(
		`✅ Date: **${normalized}**\n\n` +
			`📝 **Step 3/3**: What time? (HH:MM in 24h format)\n\n` +
			`Example: 19:30`,
		{
			state: state.merge({
				requirementStep: REQ_STEP_TIME,
				startDate: normalized,
			}),
		},
	);
}

function handleTimeInput(text: string, st: EventCreatorState, ev: MessageEvent) {
	const validation = validateTime(text);
	if (!validation.valid) {
		return reply(validation.error!);
	}

	// Required fields complete - transition to optional menu
	const updatedState: EventCreatorState = {
		...st,
		startTime: text,
		phase: "optional_menu",
		requirementStep: undefined,
	};

	return showOptionalMenu(updatedState, ev);
}
