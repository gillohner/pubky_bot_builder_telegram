// packages/demo_services/event_creator/constants.ts
// Constants for the event_creator service

export const SERVICE_ID = "event_creator";
export const SERVICE_VERSION = "1.0.0";
export const SERVICE_KIND = "command_flow" as const;
export const DEFAULT_COMMAND = "newevent";

// Flow steps
export const STEP_TITLE = 1;
export const STEP_DESCRIPTION = 2;
export const STEP_DATE = 3;
export const STEP_TIME = 4;
export const STEP_LOCATION = 5;
export const STEP_CONFIRM = 6;

// Validation
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^\d{2}:\d{2}$/;
