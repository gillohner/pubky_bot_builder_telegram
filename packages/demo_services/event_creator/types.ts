// packages/demo_services/event_creator/types.ts
// Type definitions for the enhanced event creator service

export type EventPhase = "required" | "optional_menu" | "editing";

export interface EventCreatorState {
	// Flow control
	phase?: EventPhase;
	requirementStep?: number; // 1=title, 2=date, 3=time
	editingField?: string; // Which field is being edited

	// Required fields
	title?: string;
	startDate?: string; // YYYY-MM-DD
	startTime?: string; // HH:MM

	// Optional fields
	description?: string;
	endDate?: string;
	endTime?: string;
	location?: {
		name?: string;
		address?: string;
		lat?: number;
		lng?: number;
	};
	imageFileId?: string; // Telegram file_id
	selectedCalendars?: string[]; // Additional calendar URIs beyond default

	// Index signature for SDK compatibility
	[key: string]: unknown;
}

export interface CalendarOption {
	uri: string; // pubky://user/pub/eventky.app/calendars/{id}
	name: string; // Display name
	description?: string;
	isDefault?: boolean;
}

export interface EventCreatorConfig {
	// Calendar configuration (legacy and new)
	calendarUri?: string; // Legacy single calendar
	calendars?: CalendarOption[]; // New multi-calendar mode
	defaultCalendar?: string; // Default calendar URI

	// Display & behavior
	defaultTimezone?: string; // e.g., "Europe/Vienna"
	returnMessageTemplate?: string; // Template with {url}, {title}, etc.

	// Optional field requirements
	requireLocation?: boolean;
	requireImage?: boolean;
	requireEndTime?: boolean;
}
