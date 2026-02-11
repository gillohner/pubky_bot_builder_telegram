// packages/core_services/event-creator/utils/validation.ts
// Field validation utilities

import { DATE_REGEX, MAX_DESCRIPTION_LENGTH, MAX_LOCATION_NAME_LENGTH, MAX_TITLE_LENGTH, TIME_REGEX } from "../constants.ts";

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

export function validateTitle(text: string): ValidationResult {
	if (!text || text.trim().length === 0) {
		return { valid: false, error: "Title cannot be empty." };
	}
	if (text.length > MAX_TITLE_LENGTH) {
		return {
			valid: false,
			error: `Title is too long. Maximum ${MAX_TITLE_LENGTH} characters.`,
		};
	}
	return { valid: true };
}

export function validateDescription(text: string): ValidationResult {
	if (text.length > MAX_DESCRIPTION_LENGTH) {
		return {
			valid: false,
			error: `Description is too long. Maximum ${MAX_DESCRIPTION_LENGTH} characters.`,
		};
	}
	return { valid: true };
}

export function validateDate(text: string): ValidationResult {
	if (!DATE_REGEX.test(text)) {
		return {
			valid: false,
			error: "Invalid date format. Please use YYYY-MM-DD\n\nExample: 2026-02-15",
		};
	}

	// Validate the date is in the future
	const eventDate = new Date(text);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (eventDate < today) {
		return {
			valid: false,
			error: "The event date must be in the future.",
		};
	}

	return { valid: true };
}

export function validateTime(text: string): ValidationResult {
	if (!TIME_REGEX.test(text)) {
		return {
			valid: false,
			error: "Invalid time format. Please use HH:MM (24-hour)\n\nExample: 19:30",
		};
	}

	const [hours, minutes] = text.split(":").map(Number);
	if (hours! > 23 || minutes! > 59) {
		return {
			valid: false,
			error: "Invalid time. Hours must be 0-23, minutes 0-59.",
		};
	}

	return { valid: true };
}

export function validateLocationName(text: string): ValidationResult {
	if (text.length > MAX_LOCATION_NAME_LENGTH) {
		return {
			valid: false,
			error: `Location name is too long. Maximum ${MAX_LOCATION_NAME_LENGTH} characters.`,
		};
	}
	return { valid: true };
}

export function validateEndTime(
	startDate: string,
	startTime: string,
	endDate: string,
	endTime: string,
): ValidationResult {
	const start = new Date(`${startDate}T${startTime}:00`);
	const end = new Date(`${endDate}T${endTime}:00`);

	if (end <= start) {
		return {
			valid: false,
			error: "End time must be after start time.",
		};
	}

	return { valid: true };
}
