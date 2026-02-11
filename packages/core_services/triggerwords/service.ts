// packages/core_services/triggerwords/service.ts
// Triggerwords - Listener service that responds with jokes when trigger words are detected
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
    DEFAULT_CONFIG,
    DEFAULT_DATASET,
    findMatchingEntry,
    pickRandomResponse,
    TRIGGERWORDS_CONFIG_SCHEMA,
    TRIGGERWORDS_DATASET_SCHEMAS,
    TRIGGERWORDS_SERVICE_ID,
    TRIGGERWORDS_VERSION,
    validateConfig,
    validateDataset,
    type TriggerwordsConfig,
    type TriggerwordsDataset,
} from "./constants.ts";

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
    id: TRIGGERWORDS_SERVICE_ID,
    version: TRIGGERWORDS_VERSION,
    kind: "listener",
    description: "Responds with jokes when trigger words are detected in messages",
    configSchema: TRIGGERWORDS_CONFIG_SCHEMA,
    datasetSchemas: TRIGGERWORDS_DATASET_SCHEMAS,
    handlers: {
        command: (_ev: CommandEvent) => none(),
        callback: (_ev: CallbackEvent) => none(),
        message: (ev: MessageEvent) => {
            // Get message text
            const msg = ev.message as { text?: string; message_id?: number } | undefined;
            const text = msg?.text || "";

            if (!text) {
                return none();
            }

            // Get config with defaults
            const rawConfig = ev.serviceConfig || {};
            const configValidation = validateConfig(rawConfig);
            if (!configValidation.valid) {
                console.error("Triggerwords config validation errors:", configValidation.errors);
            }
            const config: TriggerwordsConfig = { ...DEFAULT_CONFIG, ...rawConfig };

            // Check probability
            const probability = config.responseProbability ?? 1.0;
            if (probability < 1.0 && Math.random() > probability) {
                return none();
            }

            // Get triggers dataset
            let triggers: TriggerwordsDataset = DEFAULT_DATASET;
            const datasets = ev.datasets as Record<string, unknown> | undefined;
            console.debug("Triggerwords datasets received:", JSON.stringify(datasets));
            console.debug("Triggerwords config received:", JSON.stringify(ev.serviceConfig));
            if (datasets?.triggers) {
                const validation = validateDataset(datasets.triggers);
                console.debug("Dataset validation result:", JSON.stringify(validation));
                if (validation.valid) {
                    triggers = datasets.triggers as TriggerwordsDataset;
                    console.debug("Using custom triggers dataset with", triggers.entries?.length, "entries");
                } else {
                    console.error("Triggerwords dataset validation errors:", validation.errors);
                }
            } else {
                console.debug("No triggers dataset provided, using DEFAULT_DATASET");
            }

            // Find matching entry
            const matchingEntry = findMatchingEntry(text, triggers.entries);
            if (!matchingEntry) {
                return none();
            }

            // Pick random response
            const response = pickRandomResponse(matchingEntry);

            // Build reply options
            const options: Record<string, unknown> = {
                parse_mode: config.parseMode || "Markdown",
            };

            // Add reply_to_message_id if configured
            if (config.replyToMessage && msg?.message_id) {
                options.reply_to_message_id = msg.message_id;
            }

            return reply(response, { options });
        },
    },
});

export default service;
if (import.meta.main) await runService(service);
