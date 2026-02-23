// packages/core_services/event-creator/utils/state.ts
// State management utilities

import type { EventCreatorConfig, EventCreatorState } from "../types.ts";
import { validateEndTime } from "./validation.ts";

/**
 * Check if all required fields are complete
 */
export function isRequiredPhaseComplete(state: EventCreatorState): boolean {
	return !!(state.title && state.startDate && state.startTime);
}

/**
 * Check if the event can be submitted
 */
export function canSubmit(
	state: EventCreatorState,
	config: EventCreatorConfig,
): { canSubmit: boolean; error?: string } {
	// Required fields
	if (!isRequiredPhaseComplete(state)) {
		return { canSubmit: false, error: "Missing required fields" };
	}

	// Config-required fields
	if (config.requireLocation && !state.location?.name) {
		return { canSubmit: false, error: "Location is required" };
	}
	if (config.requireImage && !state.imageFileId) {
		return { canSubmit: false, error: "Image is required" };
	}
	if (config.requireEndTime && (!state.endDate || !state.endTime)) {
		return { canSubmit: false, error: "End time is required" };
	}

	// Validate end time if provided
	if (state.endDate && state.endTime) {
		const endTimeValid = validateEndTime(
			state.startDate!,
			state.startTime!,
			state.endDate,
			state.endTime,
		);
		if (!endTimeValid.valid) {
			return { canSubmit: false, error: endTimeValid.error };
		}
	}

	return { canSubmit: true };
}

/**
 * Get a display-friendly field name
 */
export function getFieldDisplayName(field: string): string {
	const names: Record<string, string> = {
		title: "Title",
		startDate: "Start Date",
		startTime: "Start Time",
		description: "Description",
		endDate: "End Date",
		endTime: "End Time",
		location: "Location",
		imageFileId: "Image",
	};
	return names[field] || field;
}

/**
 * Get the prompt text for editing a specific field
 */
export function getEditPrompt(field: string): string {
	const prompts: Record<string, string> = {
		title: "Enter new title (1-100 characters):",
		startDate: "Enter new date (DD.MM.YYYY):",
		startTime: "Enter new time (HH:MM in 24h format):",
		description: 'Enter new description (or type "clear" to remove):',
		endDate: 'Enter end date (DD.MM.YYYY) or type "clear" to remove:',
		endTime: 'Enter end time (HH:MM) or type "clear" to remove:',
		location: 'Enter location name or type "clear" to remove:',
		imageFileId: 'Send a new photo or type "clear" to remove:',
	};
	return prompts[field] || "Enter new value:";
}

/**
 * Check if a field is clearable (optional)
 */
export function isFieldClearable(field: string): boolean {
	return ["description", "endDate", "endTime", "location", "imageFileId"].includes(field);
}
