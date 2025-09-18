// src/core/security/sandbox_security_test.ts
import { initDb } from "@core/config/store.ts";
import { dispatch } from "@core/dispatch/dispatcher.ts";

initDb(":memory:");

Deno.test("sandbox denies env, fs, dynamic import in security probe", async () => {
	const res = await dispatch({
		kind: "command",
		command: "secprobe",
		ctx: { chatId: "chat-sec", userId: "user" },
	});
	if (!res.response || res.response.kind !== "reply") {
		throw new Error("Expected reply from security probe");
	}
	let parsed: Record<string, unknown> = {};
	try {
		const replyText = res.response.text;
		if (typeof replyText !== "string" || replyText.length === 0) {
			throw new Error("Security probe reply missing text");
		}
		parsed = JSON.parse(replyText);
	} catch {
		throw new Error("Probe returned invalid JSON text");
	}
	// Expect env either no_api or error / denied (must NOT expose token content)
	const env = String(parsed.env ?? "");
	if (env && (env.includes(":") ? false : true) && env.length > 0 && env !== "no_api") {
		// If it returned a plain value, that's a failure (should not access real env value)
		throw new Error(`Env access unexpectedly succeeded: ${env}`);
	}
	// FS read should be denied (choose one of probe keys)
	const fsKeyVal = String((parsed.fs as string) || (parsed.fs_readme as string) || "");
	if (!fsKeyVal.startsWith("denied:")) {
		throw new Error(`FS read should be denied, got ${fsKeyVal}`);
	}
	const imp = String(parsed.import ?? "");
	if (!imp.startsWith("denied:")) {
		throw new Error(`Dynamic import should be denied, got ${imp}`);
	}
});
