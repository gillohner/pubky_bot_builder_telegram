// packages/core_services/new-member/service.ts
// New Member Welcome - Listener service that welcomes new members to a group
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
    DEFAULT_CONFIG,
    formatWelcomeMessage,
    NEW_MEMBER_CONFIG_SCHEMA,
    NEW_MEMBER_DATASET_SCHEMAS,
    NEW_MEMBER_SERVICE_ID,
    NEW_MEMBER_VERSION,
    validateConfig,
    type UserInfo,
    type WelcomeConfig,
} from "./constants.ts";

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
    id: NEW_MEMBER_SERVICE_ID,
    version: NEW_MEMBER_VERSION,
    kind: "listener",
    description: "Welcomes new members when they join a group",
    configSchema: NEW_MEMBER_CONFIG_SCHEMA,
    datasetSchemas: NEW_MEMBER_DATASET_SCHEMAS,
    handlers: {
        command: (_ev: CommandEvent) => none(),
        callback: (_ev: CallbackEvent) => none(),
        message: (ev: MessageEvent) => {
            // Check if this is a new_chat_members event
            const msg = ev.message as {
                new_chat_members?: Array<{
                    id: number;
                    username?: string;
                    first_name?: string;
                    last_name?: string;
                    is_bot?: boolean;
                }>;
            } | undefined;

            const newMembers = msg?.new_chat_members;
            if (!newMembers || newMembers.length === 0) {
                return none();
            }

            // Filter out bots
            const humanMembers = newMembers.filter((m) => !m.is_bot);
            if (humanMembers.length === 0) {
                return none();
            }

            // Get config with defaults
            const rawConfig = ev.serviceConfig || {};
            const configValidation = validateConfig(rawConfig);
            if (!configValidation.valid) {
                console.error("New Member config validation errors:", configValidation.errors);
            }
            const config: WelcomeConfig = { ...DEFAULT_CONFIG, ...rawConfig };

            // Format welcome messages for each new member
            const messages = humanMembers.map((member) => {
                const userInfo: UserInfo = {
                    id: member.id,
                    username: member.username,
                    firstName: member.first_name,
                    lastName: member.last_name,
                };
                return formatWelcomeMessage(config.message, userInfo, config.mentionUser ?? true);
            });

            // Join messages if multiple members joined at once
            const text = messages.join("\n\n");

            return reply(text, {
                options: {
                    parse_mode: config.parseMode || "Markdown",
                },
            });
        },
    },
});

export default service;
if (import.meta.main) await runService(service);
