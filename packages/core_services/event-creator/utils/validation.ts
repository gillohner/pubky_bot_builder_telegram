// packages/core_services/event-creator/utils/validation.ts
// Field validation utilities

import {
	DATE_REGEX,
	MAX_DESCRIPTION_LENGTH,
	MAX_LOCATION_NAME_LENGTH,
	MAX_TITLE_LENGTH,
	TIME_REGEX,
} from "../constants.ts";

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
			error: "Invalid date format. Please use DD.MM.YYYY\n\nExample: 23.04.2026",
		};
	}

	const parts = parseDateParts(text);
	if (!parts) {
		return {
			valid: false,
			error: "Invalid date format. Please use DD.MM.YYYY\n\nExample: 23.04.2026",
		};
	}

	const { day, month, year } = parts;
	if (month < 1 || month > 12) {
		return { valid: false, error: "Invalid month. Must be 1-12." };
	}
	if (day < 1 || day > 31) {
		return { valid: false, error: "Invalid day. Must be 1-31." };
	}

	// Check actual validity by constructing a Date
	const dateObj = new Date(year, month - 1, day);
	if (
		dateObj.getFullYear() !== year ||
		dateObj.getMonth() !== month - 1 ||
		dateObj.getDate() !== day
	) {
		return { valid: false, error: "Invalid date. Check day/month combination." };
	}

	// Validate the date is in the future
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (dateObj < today) {
		return {
			valid: false,
			error: "The event date must be in the future.",
		};
	}

	return { valid: true };
}

/**
 * Parse a date string with any separator (. / -) into day, month, year parts.
 * Expects DD{sep}MM{sep}YYYY format.
 */
export function parseDateParts(
	input: string,
): { day: number; month: number; year: number } | null {
	const parts = input.split(/[.\/-]/);
	if (parts.length !== 3) return null;
	const day = parseInt(parts[0], 10);
	const month = parseInt(parts[1], 10);
	const year = parseInt(parts[2], 10);
	if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
	return { day, month, year };
}

/**
 * Normalize a user-entered date string to DD.MM.YYYY format.
 * Accepts any separator (. / -).
 */
export function normalizeDate(input: string): string | null {
	const parts = parseDateParts(input);
	if (!parts) return null;
	const dd = String(parts.day).padStart(2, "0");
	const mm = String(parts.month).padStart(2, "0");
	return `${dd}.${mm}.${parts.year}`;
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
	const startIso = dateToIso(startDate);
	const endIso = dateToIso(endDate);
	const start = new Date(`${startIso}T${startTime}:00`);
	const end = new Date(`${endIso}T${endTime}:00`);

	if (end <= start) {
		return {
			valid: false,
			error: "End time must be after start time.",
		};
	}

	return { valid: true };
}

/**
 * Convert DD.MM.YYYY to YYYY-MM-DD for Date constructor.
 */
function dateToIso(ddmmyyyy: string): string {
	const parts = parseDateParts(ddmmyyyy);
	if (!parts) return ddmmyyyy; // fallback
	const mm = String(parts.month).padStart(2, "0");
	const dd = String(parts.day).padStart(2, "0");
	return `${parts.year}-${mm}-${dd}`;
}
