// packages/demo_services/event_creator/handlers/message.ts
// Message handler for text input and image uploads

import { type MessageEvent, reply, state } from "@sdk/mod.ts";
import type { EventCreatorState } from "../types.ts";
import { handleRequiredFieldInput } from "../flows/required.ts";
import { handleEditFieldInput } from "../flows/edit.ts";
import { handleOptionalFieldInput } from "../flows/optional_menu.ts";

export function handleMessage(ev: MessageEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const phase = st.phase;

	switch (phase) {
		case "required":
			return handleRequiredFieldInput(ev);

		case "editing":
			return handleEditFieldInput(ev);

		case "optional_menu":
			return handleOptionalFieldInput(ev);

		default:
			return reply("Please start by using the /newevent command.", {
				state: state.clear(),
			});
	}
}
