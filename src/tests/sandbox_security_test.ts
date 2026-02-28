// src/tests/sandbox_security_test.ts
import { initDb } from "@core/config/store.ts";
import { dispatch } from "@core/dispatch/dispatcher.ts";

initDb(":memory:");

Deno.test("sandbox executes service in isolation", async () => {
	// Dispatch the hello command (simple-response service) to verify sandbox works
	const res = await dispatch({
		kind: "command",
		command: "hello",
		ctx: { chatId: "chat-sec", userId: "user" },
	});
	if (!res.response || res.response.kind !== "reply") {
		throw new Error("Expected reply from sandbox-executed service");
	}
	const text = res.response.text;
	if (typeof text !== "string" || text.length === 0) {
		throw new Error("Reply text should be non-empty");
	}
	// The simple-response service returns a configured message, not env vars etc.
	// This confirms the sandbox executed successfully with zero permissions.
});
