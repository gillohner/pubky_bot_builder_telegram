// example_services/flow/service.ts
import { defineService, none, reply, runService, state } from "@sdk/mod.ts";
import type { CommandEvent, MessageEvent } from "@sdk/mod.ts";
import { FLOW_COMMAND, FLOW_SERVICE_ID, FLOW_VERSION, FlowState } from "./constants.ts";

const service = defineService({
	id: FLOW_SERVICE_ID,
	version: FLOW_VERSION,
	kind: "command_flow",
	command: FLOW_COMMAND,
	description: "Two-step echo flow",
	handlers: {
		command: (ev: CommandEvent) => {
			const st = ev.state as FlowState | undefined || { step: 0 };
			if (!st.step || st.step === 0) {
				return reply("Flow started. Send a message.", { state: state.replace({ step: 1 }) });
			}
			return reply("Flow already active. Send next message.", {
				state: state.merge({ notice: "awaiting" }),
			});
		},
		message: (ev: MessageEvent) => {
			const st = ev.state as FlowState | undefined || { step: 0 };
			if (st.step === 1) {
				const first = (ev.message as { text?: string })?.text || "n/a";
				return reply("Got first message. Send another to finish.", {
					state: state.replace({ step: 2, first }),
				});
			}
			if (st.step === 2) {
				const second = (ev.message as { text?: string })?.text || "";
				return reply(`Done! First="${st.first || ""}" Second="${second}"`, {
					state: state.clear(),
				});
			}
			return none();
		},
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
