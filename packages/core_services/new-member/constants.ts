// packages/core_services/new-member/constants.ts
// New Member Welcome - Listener service that welcomes new members to a group

import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

// ============================================================================
// Service Identity
// ============================================================================

export const NEW_MEMBER_SERVICE_ID = "new_member" as const;
export const NEW_MEMBER_VERSION = "1.0.0" as const;

// ============================================================================
// Types
// ============================================================================

export interface WelcomeConfig {
	/** The welcome message template with placeholders */
	message: string;
	/** Whether to mention the user with @ (default: true) */
	mentionUser?: boolean;
	/** Parse mode for the message (default: "Markdown") */
	parseMode?: "Markdown" | "HTML" | "MarkdownV2";
}

export interface ValidationError {
	path: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

// ============================================================================
// JSON Schemas
// ============================================================================

export const NEW_MEMBER_CONFIG_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		message: {
			type: "string",
			description:
				"Welcome message template. Use {username}, {user_id}, {display_name}, {first_name}, {last_name} as placeholders.",
		},
		mentionUser: {
			type: "boolean",
			description: "Whether to mention the user with @ (default: true)",
		},
		parseMode: {
			type: "string",
			enum: ["Markdown", "HTML", "MarkdownV2"],
			description: "Parse mode for the message (default: Markdown)",
		},
	},
	required: ["message"],
};

export const NEW_MEMBER_DATASET_SCHEMAS: DatasetSchemas = {};

// ============================================================================
// Validation Functions
// ============================================================================

export function validateConfig(data: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({ path: "", message: "Config must be an object" });
		return { valid: false, errors };
	}

	const config = data as Record<string, unknown>;

	if (typeof config.message !== "string") {
		errors.push({ path: "message", message: "message is required and must be a string" });
	} else if (config.message.trim().length === 0) {
		errors.push({ path: "message", message: "message cannot be empty" });
	}

	if (config.mentionUser !== undefined && typeof config.mentionUser !== "boolean") {
		errors.push({ path: "mentionUser", message: "mentionUser must be a boolean" });
	}

	if (config.parseMode !== undefined) {
		const validModes = ["Markdown", "HTML", "MarkdownV2"];
		if (!validModes.includes(config.parseMode as string)) {
			errors.push({ path: "parseMode", message: `parseMode must be one of: ${validModes.join(", ")}` });
		}
	}

	return { valid: errors.length === 0, errors };
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: WelcomeConfig = {
	message: "👋 Welcome {display_name}! We're glad to have you here.",
	mentionUser: true,
	parseMode: "Markdown",
};

// ============================================================================
// Template Helpers
// ============================================================================

export interface UserInfo {
	id: number | string;
	username?: string;
	firstName?: string;
	lastName?: string;
}

export function formatWelcomeMessage(template: string, user: UserInfo, mentionUser: boolean): string {
	const username = user.username || "";
	const firstName = user.firstName || "";
	const lastName = user.lastName || "";
	const displayName = mentionUser && username
		? `@${username}`
		: firstName
		? `${firstName}${lastName ? ` ${lastName}` : ""}`
		: username || `User ${user.id}`;

	return template
		.replace(/\{username\}/gi, username)
		.replace(/\{user_id\}/gi, String(user.id))
		.replace(/\{display_name\}/gi, displayName)
		.replace(/\{first_name\}/gi, firstName)
		.replace(/\{last_name\}/gi, lastName);
}
