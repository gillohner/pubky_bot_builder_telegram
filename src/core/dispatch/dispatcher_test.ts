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
	if (!res.response || res.response.kind !== "reply") {
		throw new Error("Expected reply response kind");
	}
	if (res.response.kind === "reply" && !res.response.text.includes("Hello")) {
		throw new Error("Reply text did not contain expected greeting");
	}
});

Deno.test(
	"links command returns keyboard and callback edits message",
	async () => {
		const start = await dispatch({
			kind: "command",
			command: "links",
			ctx: { chatId: "chat-links", userId: "user" },
		});
		if (!start.response || start.response.kind !== "reply") {
			throw new Error("Expected reply with inline keyboard for /links");
		}
		const cb = await dispatch({
			kind: "callback",
			data: "svc:mock_links|c:0",
			ctx: { chatId: "chat-links", userId: "user" },
		});
		if (
			!cb.response ||
			(cb.response.kind !== "edit" && cb.response.kind !== "reply")
		) {
			throw new Error("Expected edit (or reply fallback) for links callback");
		}
		initDb(":memory:");
	},
);

Deno.test("survey flow can accept telegram photo instead of URL", async () => {
	const start = await dispatch({
		kind: "command",
		command: "survey",
		ctx: { chatId: "chat-survey-photo", userId: "user" },
	});
	if (!start.response || start.response.kind !== "reply") {
		throw new Error("Expected reply starting survey");
	}
	await dispatch({
		kind: "callback",
		data: "svc:mock_survey|color:Red",
		ctx: { chatId: "chat-survey-photo", userId: "user" },
	});
	await dispatch({
		kind: "message",
		message: { text: "tiger" },
		ctx: { chatId: "chat-survey-photo", userId: "user" },
	});
	const photoRes = await dispatch({
		kind: "message",
		message: { photo: [{ file_id: "small" }, { file_id: "large-file-id" }] },
		ctx: { chatId: "chat-survey-photo", userId: "user" },
	});
	if (!photoRes.response || photoRes.response.kind !== "photo") {
		throw new Error("Expected final photo response using file_id");
	}
	if (
		photoRes.response.kind === "photo" &&
		photoRes.response.photo !== "large-file-id"
	) {
		throw new Error("Expected to use largest photo file_id");
	}
});

Deno.test("links cancel deletes message", async () => {
	const start = await dispatch({
		kind: "command",
		command: "links",
		ctx: { chatId: "chat-links-cancel", userId: "user" },
	});
	if (!start.response || start.response.kind !== "reply") {
		throw new Error("Expected reply for /links");
	}
	const cancel = await dispatch({
		kind: "callback",
		data: "svc:mock_links|cancel",
		ctx: { chatId: "chat-links-cancel", userId: "user" },
	});
	if (!cancel.response || cancel.response.kind !== "delete") {
		throw new Error("Expected delete response for cancel");
	}
});

Deno.test(
	"survey flow with color callback, invalid animal, and image completion",
	async () => {
		// Start survey
		const start = await dispatch({
			kind: "command",
			command: "survey",
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (!start.response || start.response.kind !== "reply") {
			throw new Error("Expected reply starting survey");
		}
		// Simulate user incorrectly typing color instead of using keyboard (should get edit reminding)
		const wrongColor = await dispatch({
			kind: "message",
			message: { text: "purple-ish" },
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (
			!wrongColor.response ||
			(wrongColor.response.kind !== "edit" &&
				wrongColor.response.kind !== "reply")
		) {
			throw new Error("Expected edit reminding user to use keyboard for color");
		}
		// Choose color via callback
		const colorCb = await dispatch({
			kind: "callback",
			data: "svc:mock_survey|color:Blue",
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (
			!colorCb.response ||
			(colorCb.response.kind !== "edit" && colorCb.response.kind !== "reply")
		) {
			throw new Error("Expected edit after choosing color");
		}
		// Provide invalid animal (too short)
		const badAnimal = await dispatch({
			kind: "message",
			message: { text: "ox" },
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (
			!badAnimal.response ||
			(badAnimal.response.kind !== "edit" &&
				badAnimal.response.kind !== "reply")
		) {
			throw new Error("Expected edit on invalid animal");
		}
		// Provide valid animal
		const goodAnimal = await dispatch({
			kind: "message",
			message: { text: "otter" },
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (!goodAnimal.response || goodAnimal.response.kind !== "reply") {
			throw new Error("Expected reply prompting for image URL");
		}
		// Provide invalid URL
		const badUrl = await dispatch({
			kind: "message",
			message: { text: "not_a_url" },
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (
			!badUrl.response ||
			(badUrl.response.kind !== "edit" && badUrl.response.kind !== "reply")
		) {
			throw new Error("Expected edit on invalid URL");
		}
		// Provide valid image URL (using placeholder image)
		const final = await dispatch({
			kind: "message",
			message: { text: "https://example.com/otter.jpg" },
			ctx: { chatId: "chat-survey", userId: "user" },
		});
		if (!final.response || final.response.kind !== "photo") {
			throw new Error("Expected photo response completing survey");
		}
	},
);
