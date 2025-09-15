import flow from "./service.ts";
import { CommandEvent, MessageEvent, ServiceResponse } from "@sdk/runtime.ts";

const ctx = { chatId: "c", userId: "u" };

Deno.test("flow progresses through steps", () => {
	let res = flow.handlers.command({ type: "command", ...ctx } as CommandEvent) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected start reply");
	res = flow.handlers.message(
		{ type: "message", message: { text: "one" }, ...ctx, state: { step: 1 } } as MessageEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected second step reply");
	res = flow.handlers.message(
		{
			type: "message",
			message: { text: "two" },
			...ctx,
			state: { step: 2, first: "one" },
		} as MessageEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected completion reply");
});
