import secProbe from "./service.ts";
import { CommandEvent, ServiceResponse } from "@sdk/runtime.ts";

Deno.test("security probe merged env probe returns structured reply", async () => {
	const res = await secProbe.handlers.command(
		{ type: "command", chatId: "c", userId: "u" } as CommandEvent,
	) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected reply");
	if (typeof res.text !== "string") throw new Error("reply text missing");
	try {
		const parsed = JSON.parse(res.text);
		if (!parsed.report || !parsed.legacy) throw new Error("Missing merged fields");
		if (!("env" in parsed) || !("import" in parsed)) {
			throw new Error("Top-level probe keys missing");
		}
	} catch (err) {
		throw new Error("Response not valid JSON: " + (err as Error).message);
	}
});
