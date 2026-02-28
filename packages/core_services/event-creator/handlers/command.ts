// packages/core_services/event-creator/handlers/command.ts
// Command handler for starting the event creation flow

import { type CommandEvent, reply, state } from "@sdk/mod.ts";
import { REQ_STEP_TITLE } from "../constants.ts";
import type { EventCreatorConfig } from "../types.ts";
import { getCalendarName, getDefaultCalendarUri } from "../utils/calendar.ts";
import { escapeHtml } from "../utils/formatting.ts";

export function handleCommand(ev: CommandEvent) {
	const config = ev.serviceConfig as EventCreatorConfig | undefined;
	const calCount = config?.calendars?.length ?? 0;

	// Display welcome message with calendar info
	const defaultUri = config ? getDefaultCalendarUri(config) : undefined;
	const lines: string[] = ["🎉 <b>Create a New Event</b>\n"];

	if (defaultUri && config) {
		lines.push(`📅 Calendar: <b>${escapeHtml(getCalendarName(defaultUri, config))}</b>`);
		if (calCount > 1) {
			lines.push(`   <i>(+${calCount - 1} more available)</i>`);
		}
		lines.push("");
	}

	lines.push(`📝 <b>Step 1/3</b>: What's the event title? (max ${100} characters)`);

	return reply(lines.join("\n"), {
		state: state.replace({
			phase: "required",
			requirementStep: REQ_STEP_TITLE,
		}),
		options: { parse_mode: "HTML" },
	});
}
