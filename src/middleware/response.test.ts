// src/middleware/response.test.ts
import { applyServiceResponse } from "@middleware/response.ts";
import type { ServiceResponse } from "@core/service_types.ts";
import type { Context } from "grammy";

// Minimal mock context
class MockCtx {
	public replies: { text: string; options?: Record<string, unknown> }[] = [];
	public edits: { text: string }[] = [];
	public chat = { id: 1 } as const;
	public msg = { message_id: 10 } as const;
	public callbackQuery: null = null;
	public failWithNoop = false;
	public deleted: number[] = [];
	api = {
		editMessageText: (_chatId: number, _messageId: number, text: string) => {
			if (this.failWithNoop) {
				const err = new Error(
					"Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message",
				);
				interface DescErr {
					description?: string;
				}
				(err as unknown as DescErr).description = err.message; // emulate grammy error shape
				throw err;
			}
			this.edits.push({ text });
			return { message_id: _messageId } as unknown;
		},
		deleteMessage: (_chatId: number, messageId: number) => {
			this.deleted.push(messageId);
			return true as unknown;
		},
	};
	reply(text: string, options?: Record<string, unknown>) {
		this.replies.push({ text, options });
		return { message_id: this.msg.message_id + this.replies.length } as unknown;
	}
}

type Ctx = InstanceType<typeof MockCtx>;

Deno.test("applyServiceResponse handles reply", async () => {
	const ctx = new MockCtx();
	const resp: ServiceResponse = { kind: "reply", text: "Hello" };
	await applyServiceResponse(ctx as unknown as Context, resp);
	if (ctx.replies.length !== 1 || ctx.replies[0].text !== "Hello") {
		throw new Error("Expected one reply with correct text");
	}
});

Deno.test("applyServiceResponse handles edit", async () => {
	const ctx = new MockCtx();
	const resp: ServiceResponse = { kind: "edit", text: "Updated" };
	await applyServiceResponse(ctx as unknown as Context, resp);
	if (ctx.edits.length !== 1 || ctx.edits[0].text !== "Updated") {
		throw new Error("Expected one edit with updated text");
	}
});

Deno.test("applyServiceResponse handles error", async () => {
	const ctx = new MockCtx();
	const resp: ServiceResponse = { kind: "error", message: "Boom" };
	await applyServiceResponse(ctx as unknown as Context, resp);
	if (ctx.replies.length !== 1 || !ctx.replies[0].text.includes("Boom")) {
		throw new Error("Expected error reply containing message");
	}
});

Deno.test("applyServiceResponse ignores none", async () => {
	const ctx = new MockCtx();
	const resp: ServiceResponse = { kind: "none" };
	await applyServiceResponse(ctx as unknown as Context, resp);
	if (ctx.replies.length !== 0 || ctx.edits.length !== 0) {
		throw new Error("Expected no actions for none response");
	}
});

Deno.test(
	"applyServiceResponse suppresses fallback on no-op edit",
	async () => {
		const ctx = new MockCtx();
		ctx.failWithNoop = true;
		const resp: ServiceResponse = { kind: "edit", text: "Same" };
		await applyServiceResponse(ctx as unknown as Context, resp);
		if (ctx.replies.length !== 0) {
			throw new Error("Expected no fallback reply for no-op edit");
		}
	},
);

Deno.test("applyServiceResponse handles delete", async () => {
	const ctx = new MockCtx();
	// simulate callback context to provide message to delete
	interface CQ {
		message: { message_id: number };
	}
	(ctx as unknown as { callbackQuery: CQ }).callbackQuery = {
		message: ctx.msg,
	};
	const resp: ServiceResponse = { kind: "delete" } as ServiceResponse;
	await applyServiceResponse(ctx as unknown as Context, resp);
	if (ctx.deleted.length !== 1 || ctx.deleted[0] !== ctx.msg.message_id) {
		throw new Error("Expected one deleted message matching original id");
	}
});
