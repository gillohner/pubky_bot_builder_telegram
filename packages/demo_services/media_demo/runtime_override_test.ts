import { assertEquals } from "jsr:@std/assert@1";
import service from "./service.ts";
import { runService } from "@sdk/mod.ts";

// This test simulates providing routeMeta via stdin to the sandbox runtime (runner)
// to ensure manifest id/command/description are overridden at runtime.

Deno.test("media demo runtime overrides manifest from routeMeta", async () => {
	// Prepare a fake payload that the sandbox host would send.
	const payload = {
		event: { type: "command" as const, token: "media" },
		ctx: {
			chatId: "chat-1",
			userId: "user-1",
			routeMeta: { id: "media_demo", command: "media", description: "Runtime Media Demo" },
		},
		manifest: { schemaVersion: 1 },
	};

	// Serialize payload to a ReadableStream to mimic stdin.
	const encoder = new TextEncoder();
	const data = encoder.encode(JSON.stringify(payload));
	// Monkey patch Deno.stdin for this test only.
	const originalStdin = Deno.stdin;
	// @ts-ignore: overriding stdin readable stream for test simulation
	Deno.stdin = {
		readable: new ReadableStream({
			start(c) {
				c.enqueue(data);
				c.close();
			},
		}),
	};

	try {
		await runService(service);
		// After run, service manifest should be updated.
		assertEquals(service.manifest.id, "media_demo");
		assertEquals(service.manifest.command, "media");
		assertEquals(service.manifest.description, "Runtime Media Demo");
	} finally {
		// restore stdin
		// @ts-ignore: restoring original stdin after test
		Deno.stdin = originalStdin;
	}
});
