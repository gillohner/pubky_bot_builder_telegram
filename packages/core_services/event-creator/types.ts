// packages/core_services/event-creator/types.ts
// Type definitions for the enhanced event creator service

// Re-export types that moved to constants.ts for schema co-location
export type { CalendarOption, EventCreatorConfig } from "./constants.ts";

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
