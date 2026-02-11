// packages/core_services/event-creator/service.ts
// Enhanced event creator service for Eventky - creates events on Pubky with admin approval
// v2.0.0 - Two-phase flow with optional fields, image uploads, and multi-calendar support

import { defineService, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	EVENT_CREATOR_CONFIG_SCHEMA,
	EVENT_CREATOR_DATASET_SCHEMAS,
	EVENT_CREATOR_SERVICE_ID,
	EVENT_CREATOR_VERSION,
	SERVICE_KIND,
} from "./constants.ts";
import { handleCommand } from "./handlers/command.ts";
import { handleCallback } from "./handlers/callback.ts";
import { handleMessage } from "./handlers/message.ts";

const service = defineService({
	id: EVENT_CREATOR_SERVICE_ID,
	version: EVENT_CREATOR_VERSION,
	kind: SERVICE_KIND,
	description: "Creates events on Pubky with admin approval, image uploads, and multi-calendar support",
	configSchema: EVENT_CREATOR_CONFIG_SCHEMA,
	datasetSchemas: EVENT_CREATOR_DATASET_SCHEMAS,

	handlers: {
		command: (ev: CommandEvent) => handleCommand(ev),
		message: (ev: MessageEvent) => handleMessage(ev),
		callback: (ev: CallbackEvent) => handleCallback(ev),
	},
});

export default service;

// Allow running as standalone service
if (import.meta.main) await runService(service);
