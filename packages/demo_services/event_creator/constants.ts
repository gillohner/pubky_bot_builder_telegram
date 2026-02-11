// packages/demo_services/event_creator/constants.ts
// Constants for the event_creator service

export const SERVICE_ID = "event_creator";
export const SERVICE_VERSION = "2.0.0";
export const SERVICE_KIND = "command_flow" as const;
export const DEFAULT_COMMAND = "newevent";

// Required field steps (phase: "required")
export const REQ_STEP_TITLE = 1;
export const REQ_STEP_DATE = 2;
export const REQ_STEP_TIME = 3;

// Validation patterns
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^\d{2}:\d{2}$/;

// Field limits
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_LOCATION_NAME_LENGTH = 200;

// Callback data prefixes
export const CB_MENU_PREFIX = "menu:";
export const CB_CALENDAR_PREFIX = "calendar:";
export const CB_EDIT_PREFIX = "edit:";

// Default templates
export const DEFAULT_RETURN_TEMPLATE =
	'✅ Your event "{title}" has been published!\n\n🔗 View: {url}';

// Eventky.app URL base
export const EVENTKY_APP_BASE = "https://eventky.app";
