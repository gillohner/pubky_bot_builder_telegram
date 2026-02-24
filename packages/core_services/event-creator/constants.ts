// packages/core_services/event-creator/constants.ts
// Event Creator service constants, schemas, and validation

import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

// ============================================================================
// Service Identity
// ============================================================================

export const EVENT_CREATOR_SERVICE_ID = "event_creator" as const;
export const EVENT_CREATOR_VERSION = "2.0.0" as const;
export const SERVICE_KIND = "command_flow" as const;
export const DEFAULT_COMMAND = "newevent";

// ============================================================================
// Existing Constants (unchanged)
// ============================================================================

// Required field steps (phase: "required")
export const REQ_STEP_TITLE = 1;
export const REQ_STEP_DATE = 2;
export const REQ_STEP_TIME = 3;

// Validation patterns
export const DATE_REGEX = /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/;
export const TIME_REGEX = /^\d{2}:\d{2}$/;

// Field limits
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_LOCATION_NAME_LENGTH = 200;

// Callback data prefixes
export const CB_MENU_PREFIX = "menu:";
export const CB_CALENDAR_PREFIX = "calendar:";
export const CB_EDIT_PREFIX = "edit:";
export const CB_LOCATION_PREFIX = "location:";
export const LOC_REPLACE_GROUP = "ec_location";
export const MENU_REPLACE_GROUP = "ec_menu";
export const CAL_REPLACE_GROUP = "ec_calendar";

// Default templates
export const DEFAULT_RETURN_TEMPLATE =
	'✅ Your event "{title}" has been published!\n\n🔗 View: {url}';

// Eventky.app URL base
export const EVENTKY_APP_BASE = "https://eventky.app";

// ============================================================================
// Types
// ============================================================================

export interface CalendarOption {
	uri: string;
	name?: string;
	description?: string;
	isDefault?: boolean;
}

export interface EventCreatorConfig {
	calendars?: CalendarOption[];
	defaultTimezone?: string;
	returnMessageTemplate?: string;
	requireLocation?: boolean;
	requireImage?: boolean;
	requireEndTime?: boolean;
}

// ============================================================================
// JSON Schemas
// ============================================================================

/**
 * Schema for a single CalendarOption object
 */
export const CALENDAR_OPTION_SCHEMA: JSONSchema = {
	type: "object",
	title: "Calendar",
	description: "A calendar that events can be published to",
	properties: {
		uri: {
			type: "string",
			title: "Calendar URI",
			description: "Pubky URI for the calendar (e.g., pubky://user/pub/eventky.app/calendars/id)",
			format: "uri",
		},
		name: {
			type: "string",
			title: "Display Name",
			description: "Human-readable name for this calendar",
			minLength: 1,
			maxLength: 100,
		},
		description: {
			type: "string",
			title: "Description",
			description: "Optional description of this calendar",
			maxLength: 500,
		},
		isDefault: {
			type: "boolean",
			title: "Default Calendar",
			description: "Whether this is the default calendar for new events",
			default: false,
		},
	},
	required: ["uri", "name"],
};

/**
 * Schema for the service config - used by the configurator's SchemaForm
 */
export const EVENT_CREATOR_CONFIG_SCHEMA: JSONSchema = {
	type: "object",
	title: "Event Creator Configuration",
	description: "Configuration options for the event creator service",
	properties: {
		calendars: {
			type: "array",
			title: "Calendars",
			description: "List of calendars that events can be published to",
			items: CALENDAR_OPTION_SCHEMA,
			minItems: 0,
		},
		defaultTimezone: {
			type: "string",
			title: "Default Timezone",
			description: "IANA timezone identifier (e.g., 'Europe/Vienna', 'America/New_York')",
		},
		returnMessageTemplate: {
			type: "string",
			title: "Return Message Template",
			description:
				"Message template shown after event is published. Supports {url}, {title}, {date}, {time} placeholders.",
			maxLength: 500,
		},
		requireLocation: {
			type: "boolean",
			title: "Require Location",
			description: "Whether location is required before submitting an event",
			default: false,
		},
		requireImage: {
			type: "boolean",
			title: "Require Image",
			description: "Whether an image is required before submitting an event",
			default: false,
		},
		requireEndTime: {
			type: "boolean",
			title: "Require End Time",
			description: "Whether an end time is required before submitting an event",
			default: false,
		},
	},
};

/**
 * Dataset schemas for the service (empty - no datasets needed)
 */
export const EVENT_CREATOR_DATASET_SCHEMAS: DatasetSchemas = {};

// ============================================================================
// Validation
// ============================================================================

export interface ValidationError {
	path: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

/**
 * Validates a single CalendarOption object
 */
export function validateCalendarOption(option: unknown, index: number): ValidationError[] {
	const errors: ValidationError[] = [];
	const prefix = `calendars[${index}]`;

	if (typeof option !== "object" || option === null) {
		errors.push({ path: prefix, message: "Calendar option must be an object" });
		return errors;
	}

	const o = option as Record<string, unknown>;

	if (typeof o.uri !== "string" || o.uri.length === 0) {
		errors.push({
			path: `${prefix}.uri`,
			message: "URI is required and must be a non-empty string",
		});
	}

	if (o.name !== undefined) {
		if (typeof o.name !== "string") {
			errors.push({ path: `${prefix}.name`, message: "Name must be a string" });
		} else if (o.name.length > 100) {
			errors.push({ path: `${prefix}.name`, message: "Name must be 100 characters or less" });
		}
	}

	if (o.description !== undefined) {
		if (typeof o.description !== "string") {
			errors.push({ path: `${prefix}.description`, message: "Description must be a string" });
		} else if (o.description.length > 500) {
			errors.push({
				path: `${prefix}.description`,
				message: "Description must be 500 characters or less",
			});
		}
	}

	if (o.isDefault !== undefined && typeof o.isDefault !== "boolean") {
		errors.push({ path: `${prefix}.isDefault`, message: "isDefault must be a boolean" });
	}

	return errors;
}

/**
 * Validates the event creator config
 */
export function validateConfig(config: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (config === undefined || config === null) {
		return { valid: true, errors: [] }; // Config is optional
	}

	if (typeof config !== "object") {
		return { valid: false, errors: [{ path: "", message: "Config must be an object" }] };
	}

	const c = config as Record<string, unknown>;

	// calendars
	if (c.calendars !== undefined) {
		if (!Array.isArray(c.calendars)) {
			errors.push({ path: "calendars", message: "calendars must be an array" });
		} else {
			for (let i = 0; i < c.calendars.length; i++) {
				errors.push(...validateCalendarOption(c.calendars[i], i));
			}
		}
	}

	// defaultTimezone
	if (c.defaultTimezone !== undefined && typeof c.defaultTimezone !== "string") {
		errors.push({ path: "defaultTimezone", message: "defaultTimezone must be a string" });
	}

	// returnMessageTemplate
	if (c.returnMessageTemplate !== undefined) {
		if (typeof c.returnMessageTemplate !== "string") {
			errors.push({
				path: "returnMessageTemplate",
				message: "returnMessageTemplate must be a string",
			});
		} else if (c.returnMessageTemplate.length > 500) {
			errors.push({
				path: "returnMessageTemplate",
				message: "returnMessageTemplate must be 500 characters or less",
			});
		}
	}

	// Boolean fields
	const boolFields = ["requireLocation", "requireImage", "requireEndTime"];
	for (const field of boolFields) {
		if (c[field] !== undefined && typeof c[field] !== "boolean") {
			errors.push({ path: field, message: `${field} must be a boolean` });
		}
	}

	return { valid: errors.length === 0, errors };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG: EventCreatorConfig = {
	defaultTimezone: "UTC",
	returnMessageTemplate: DEFAULT_RETURN_TEMPLATE,
	requireLocation: false,
	requireImage: false,
	requireEndTime: false,
};

// ============================================================================
// Legacy aliases (used by handlers and flows)
// ============================================================================

export const SERVICE_ID = EVENT_CREATOR_SERVICE_ID;
export const SERVICE_VERSION = EVENT_CREATOR_VERSION;
