// example_services/flow.ts (SDK version)
import { defineService, none, reply, runService, state } from "@/sdk/runtime.ts";

interface FlowState {
	step?: number;
	first?: string;
}

const service = defineService({
	id: "mock_flow",
	version: "1.0.0",
	kind: "command_flow",
	command: "flow",
	description: "Two-step echo flow",
	handlers: {
		command: (ev) => {
			const st = (ev.state as FlowState) || { step: 0 };
			if (!st.step || st.step === 0) {
				return reply("Flow started. Send a message.", { state: state.replace({ step: 1 }) });
			}
			return reply("Flow already active. Send next message.", {
				state: state.merge({ notice: "awaiting" }),
			});
		},
		message: (ev) => {
			const st = (ev.state as FlowState) || { step: 0 };
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
