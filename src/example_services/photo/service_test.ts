import photo from "./service.ts";
import { CommandEvent, ServiceResponse } from "@sdk/runtime.ts";

Deno.test("photo command returns photo response", () => {
	const res = photo.handlers.command(
		{ type: "command", chatId: "c", userId: "u" } as CommandEvent,
	) as ServiceResponse;
	if (res.kind !== "photo") throw new Error("Expected photo kind");
});
