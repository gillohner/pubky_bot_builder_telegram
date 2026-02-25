// packages/core_services/simple-response/constants.ts
// Simple Response - Single command service that responds with a configured message

import type { DatasetSchemas, JSONSchema } from "@sdk/mod.ts";

// ============================================================================
// Service Identity
// ============================================================================

export const SIMPLE_RESPONSE_SERVICE_ID = "simple_response" as const;
export const SIMPLE_RESPONSE_VERSION = "1.0.0" as const;

// ============================================================================
// Types
// ============================================================================

export interface SimpleResponseConfig {
    /** The response message to send */
    message: string;
    /** Parse mode for the message (default: "Markdown") */
    parseMode?: "Markdown" | "HTML" | "MarkdownV2";
    /** Whether to disable link previews (default: false) */
    disableLinkPreview?: boolean;
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

export const SIMPLE_RESPONSE_CONFIG_SCHEMA: JSONSchema = {
    type: "object",
    properties: {
        message: {
            type: "string",
            description: "The response message to send when the command is invoked",
            format: "textarea",
            maxLength: 4000,
        },
        parseMode: {
            type: "string",
            enum: ["Markdown", "HTML", "MarkdownV2"],
            description: "Parse mode for the message (default: Markdown)",
        },
        disableLinkPreview: {
            type: "boolean",
            description: "Whether to disable link previews (default: false)",
        },
    },
    required: ["message"],
};

export const SIMPLE_RESPONSE_DATASET_SCHEMAS: DatasetSchemas = {};

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

    if (config.parseMode !== undefined) {
        const validModes = ["Markdown", "HTML", "MarkdownV2"];
        if (!validModes.includes(config.parseMode as string)) {
            errors.push({ path: "parseMode", message: `parseMode must be one of: ${validModes.join(", ")}` });
        }
    }

    if (config.disableLinkPreview !== undefined && typeof config.disableLinkPreview !== "boolean") {
        errors.push({ path: "disableLinkPreview", message: "disableLinkPreview must be a boolean" });
    }

    return { valid: errors.length === 0, errors };
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: SimpleResponseConfig = {
    message: "Hello! This is a simple response.",
    parseMode: "Markdown",
    disableLinkPreview: false,
};
