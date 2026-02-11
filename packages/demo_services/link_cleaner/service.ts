// packages/demo_services/link_cleaner/service.ts
// Demonstrates using an npm package (tidy-url) in a service
import { defineService, none, reply, runService, state } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent, JSONSchema } from "@sdk/mod.ts";
import { TidyURL } from "npm:tidy-url@1";
import {
    LINK_CLEANER_COMMAND,
    LINK_CLEANER_SERVICE_ID,
    LINK_CLEANER_VERSION,
} from "./constants.ts";

interface LinkCleanerState {
    step: "awaiting_url";
}

// Config schema for the service
const configSchema: JSONSchema = {
    type: "object",
    properties: {
        allowRedirects: {
            type: "boolean",
            title: "Allow Redirects",
            description: "Whether to follow redirects when cleaning URLs",
            default: false,
        },
        showOriginal: {
            type: "boolean",
            title: "Show Original",
            description: "Show the original URL alongside the cleaned one",
            default: true,
        },
    },
};

const service = defineService({
    id: LINK_CLEANER_SERVICE_ID,
    version: LINK_CLEANER_VERSION,
    kind: "command_flow",
    command: LINK_CLEANER_COMMAND,
    description: "Clean tracking parameters from URLs using tidy-url",
    npmDependencies: ["tidy-url"],
    configSchema,
    handlers: {
        command: (_ev: CommandEvent) => {
            return reply(
                "🧹 *Link Cleaner*\n\nSend me a URL and I'll remove tracking parameters from it.",
                {
                    options: { parse_mode: "Markdown" },
                    state: state.replace({ step: "awaiting_url" }),
                },
            );
        },
        callback: (_ev: CallbackEvent) => none(),
        message: (ev: MessageEvent) => {
            const msg = ev.message as { text?: string } | undefined;
            const text = msg?.text || "";

            // Try to extract URL from the message
            const urlMatch = text.match(/https?:\/\/[^\s]+/);
            if (!urlMatch) {
                return reply(
                    "❌ No valid URL found. Please send a message containing a URL.",
                    { options: { parse_mode: "Markdown" } },
                );
            }

            const originalUrl = urlMatch[0];

            try {
                // Use tidy-url to clean the URL
                const result = TidyURL.clean(originalUrl);

                if (result.url === originalUrl) {
                    return reply(
                        `✅ This URL is already clean!\n\n\`${originalUrl}\``,
                        {
                            options: { parse_mode: "Markdown" },
                            state: { op: "clear" },
                        },
                    );
                }

                const infoLines: string[] = [];
                if (result.info?.removed && result.info.removed.length > 0) {
                    infoLines.push(`*Removed parameters:* ${result.info.removed.join(", ")}`);
                }

                return reply(
                    `🧹 *Cleaned URL*\n\n` +
                    `*Original:*\n\`${originalUrl}\`\n\n` +
                    `*Cleaned:*\n\`${result.url}\`\n\n` +
                    (infoLines.length > 0 ? infoLines.join("\n") : ""),
                    {
                        options: { parse_mode: "Markdown" },
                        state: { op: "clear" },
                    },
                );
            } catch (err) {
                return reply(
                    `❌ Error cleaning URL: ${(err as Error).message}`,
                    {
                        options: { parse_mode: "Markdown" },
                        state: { op: "clear" },
                    },
                );
            }
        },
    },
});

export default service;
if (import.meta.main) await runService(service);
