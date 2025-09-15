import secProbe from "./service.ts";
import { CommandEvent, ServiceResponse } from "@sdk/runtime.ts";

Deno.test("security probe returns reply", async () => {
	const res = await secProbe.handlers.command(
		{ type: "command", chatId: "c", userId: "u" } as CommandEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected reply");
});
