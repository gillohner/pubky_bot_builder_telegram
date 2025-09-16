import links from "./service.ts";
import { CallbackEvent, CommandEvent, ServiceResponse } from "@sdk/runtime.ts";

const ctx = { chatId: "c", userId: "u" };

Deno.test("links command returns categories keyboard", () => {
	const res = links.handlers.command(
		{ type: "command", ...ctx } as CommandEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected reply");
});

Deno.test("links category callback edits message", () => {
	const res = links.handlers.callback(
		{ type: "callback", data: "svc:mock_links|c:0", ...ctx } as CallbackEvent,
	) as ServiceResponse;
	if (res.kind !== "edit") throw new Error("Expected edit");
});
