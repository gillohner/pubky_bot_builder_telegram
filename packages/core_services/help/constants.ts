// packages/core_services/help/constants.ts
// Help - Single command service that shows a configurable help message with optional command list

import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

// ============================================================================
// Service Identity
// ============================================================================

export const HELP_SERVICE_ID = "help" as const;
export const HELP_VERSION = "1.0.0" as const;

// ============================================================================
// Types
// ============================================================================

export interface HelpCommandEntry {
	/** Command name (e.g. "/start") */
	command: string;
	/** Description of what the command does */
	description: string;
}

export interface HelpConfig {
	/** Main help text (Markdown) */
	message: string;
	/** Optional list of commands to append */
	commands?: HelpCommandEntry[];
	/** Whether to append the command list (default: true) */
	showCommandList?: boolean;
	/** Parse mode (default: "Markdown") */
	parseMode?: "Markdown" | "HTML" | "MarkdownV2";
}

// ============================================================================
// JSON Schemas
// ============================================================================

export const HELP_COMMAND_ENTRY_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		command: {
			type: "string",
			title: "Command",
			description: "Command name (e.g. /start)",
			minLength: 1,
			maxLength: 50,
		},
		description: {
			type: "string",
			title: "Description",
			description: "What the command does",
			minLength: 1,
			maxLength: 200,
		},
	},
	required: ["command", "description"],
};

export const HELP_CONFIG_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		message: {
			type: "string",
			title: "Help Message",
			description: "The main help message to display (supports Markdown)",
			format: "textarea",
			maxLength: 2000,
		},
		commands: {
			type: "array",
			title: "Commands",
			description: "List of commands to show in the help message",
			items: HELP_COMMAND_ENTRY_SCHEMA,
		},
		showCommandList: {
			type: "boolean",
			title: "Show Command List",
			description: "Whether to append the command list after the message (default: true)",
		},
		parseMode: {
			type: "string",
			enum: ["Markdown", "HTML", "MarkdownV2"],
			description: "Parse mode for the message (default: Markdown)",
		},
	},
	required: ["message"],
};

export const HELP_DATASET_SCHEMAS: DatasetSchemas = {};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escape HTML entities in user-provided text to prevent injection
 * and ensure valid HTML parse mode output.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function formatHelpMessage(config: HelpConfig): string {
	// Escape user-provided message to avoid breaking HTML parse mode
	let text = escapeHtml(config.message);

	const showCommands = config.showCommandList !== false;
	if (showCommands && config.commands && config.commands.length > 0) {
		text += "\n\n<b>Commands:</b>\n";
		text += config.commands
			.map((c) => `${escapeHtml(c.command)} — ${escapeHtml(c.description)}`)
			.join("\n");
	}

	return text;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: HelpConfig = {
	message: "Welcome! Here's what I can do:",
	commands: [],
	showCommandList: true,
	parseMode: "Markdown",
};
