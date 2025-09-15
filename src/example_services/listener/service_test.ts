import listener from "./service.ts";
import { MessageEvent, ServiceResponse } from "@sdk/runtime.ts";

Deno.test("listener responds to message", () => {
	const res = listener.handlers.message(
		{ type: "message", chatId: "c", userId: "u", message: { text: "hi" } } as MessageEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected reply");
});
