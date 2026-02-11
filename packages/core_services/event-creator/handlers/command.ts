// packages/core_services/event-creator/handlers/command.ts
// Command handler for starting the event creation flow

import { reply, state, type CommandEvent } from "@sdk/mod.ts";
import { REQ_STEP_TITLE } from "../constants.ts";
import type { EventCreatorConfig } from "../types.ts";

export function handleCommand(ev: CommandEvent) {
	const config = ev.serviceConfig as EventCreatorConfig | undefined;

	// Display welcome message
	const calendarInfo = config?.calendarUri || config?.defaultCalendar
		? `\n📅 Default Calendar: ${(config.calendarUri || config.defaultCalendar)?.split("/").pop()}`
		: "";

	return reply(
		`🎉 **Create a New Event**${calendarInfo}\n\n` +
			"Let's create an event! I'll collect the essential details first.\n\n" +
			`📝 **Step 1/3**: What's the event title? (1-${100} characters)`,
		{
			state: state.replace({
				phase: "required",
				requirementStep: REQ_STEP_TITLE,
			}),
		},
	);
}
