// src/core/dispatch/dispatcher_test.ts
import { dispatch } from "@core/dispatch/dispatcher.ts";
import { initDb } from "@core/config/store.ts";
// Initialize DB once for all dispatcher tests
initDb(":memory:");

Deno.test("dispatch handles command event without error", async () => {
	const res = await dispatch({
		kind: "command",
		command: "start",
		ctx: { chatId: "1", userId: "2" },
	});
	if (res.response !== null) {
		throw new Error("Expected null response for unknown command");
	}
});

Deno.test("dispatch handles callback event without error", async () => {
	const res = await dispatch({
		kind: "callback",
		data: "foo",
		ctx: { chatId: "1", userId: "2" },
	});
	if (res.response !== null) {
		throw new Error("Expected null for callback no-op");
	}
});

Deno.test("dispatch handles message event without error", async () => {
	const res = await dispatch({
		kind: "message",
		message: { text: "hello" },
		ctx: { chatId: "1", userId: "2" },
	});
	if (res.response && res.response.kind !== "reply") {
		throw new Error("Listener should only emit reply or none");
	}
});

Deno.test("dispatch executes mock hello command in sandbox", async () => {
	const res = await dispatch({
		kind: "command",
		command: "hello",
		ctx: { chatId: "1", userId: "2" },
	});
	const reply = res.response;
	if (
		!reply ||
		reply.kind !== "reply" ||
		typeof reply.text !== "string"
	) {
		throw new Error("Expected reply response kind with text");
	}
	if (!reply.text.includes("Hello")) {
		throw new Error("Reply text did not contain expected greeting");
	}
});

Deno.test(
	"links command returns ui keyboard and callback edits message",
	async () => {
		const start = await dispatch({
			kind: "command",
			command: "links",
			ctx: { chatId: "chat-links", userId: "user" },
		});
		if (!start.response || start.response.kind !== "ui") {
			throw new Error("Expected ui response with inline keyboard for /links");
		}
		const cb = await dispatch({
			kind: "callback",
			data: "svc:links|c:0",
			ctx: { chatId: "chat-links", userId: "user" },
		});
		if (
			!cb.response ||
			(cb.response.kind !== "edit" && cb.response.kind !== "ui")
		) {
			throw new Error("Expected edit (or ui) for links callback");
		}
		initDb(":memory:");
	},
);

Deno.test("links close deletes message", async () => {
	const start = await dispatch({
		kind: "command",
		command: "links",
		ctx: { chatId: "chat-links-close", userId: "user" },
	});
	if (!start.response || start.response.kind !== "ui") {
		throw new Error("Expected ui response for /links");
	}
	const close = await dispatch({
		kind: "callback",
		data: "svc:links|close",
		ctx: { chatId: "chat-links-close", userId: "user" },
	});
	if (!close.response || close.response.kind !== "delete") {
		throw new Error("Expected delete response for close");
	}
});
