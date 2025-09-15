import survey from "./service.ts";
import { CallbackEvent, CommandEvent, MessageEvent, ServiceResponse } from "@sdk/runtime.ts";

const base = { chatId: "c", userId: "u" };

Deno.test("survey minimal progression", () => {
	let res = survey.handlers.command(
		{ type: "command", ...base } as CommandEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected survey start reply");
	res = survey.handlers.callback(
		{
			type: "callback",
			data: "svc:mock_survey|color:Red",
			...base,
			state: { stage: 1 },
		} as CallbackEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected color chosen reply");
	res = survey.handlers.message(
		{
			type: "message",
			message: { text: "otter" },
			...base,
			state: { stage: 2, color: "Red" },
		} as MessageEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected prompt for image");
});
