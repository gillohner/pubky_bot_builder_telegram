// packages/demo_services/event_creator/service.ts
// Enhanced event creator service for Eventky - creates events on Pubky with admin approval
// v2.0.0 - Two-phase flow with optional fields, image uploads, and multi-calendar support

import { defineService, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import { SERVICE_ID, SERVICE_KIND, SERVICE_VERSION } from "./constants.ts";
import { handleCommand } from "./handlers/command.ts";
import { handleCallback } from "./handlers/callback.ts";
import { handleMessage } from "./handlers/message.ts";

const service = defineService({
	id: SERVICE_ID,
	version: SERVICE_VERSION,
	kind: SERVICE_KIND,

	handlers: {
		command: (ev: CommandEvent) => handleCommand(ev),
		message: (ev: MessageEvent) => handleMessage(ev),
		callback: (ev: CallbackEvent) => handleCallback(ev),
	},
});

export default service;

// Allow running as standalone service
if (import.meta.main) await runService(service);
