// src/middleware/response.test.ts
import { applyServiceResponse } from "./response.ts";
import type { ServiceResponse } from "@core/service_types.ts";
import type { Context } from "grammy";

// Minimal mock context
class MockCtx {
  public replies: { text: string; options?: Record<string, unknown> }[] = [];
  public edits: { text: string }[] = [];
  public chat = { id: 1 } as const;
  public msg = { message_id: 10 } as const;
  public callbackQuery: null = null;
  api = {
    editMessageText: (_chatId: number, _messageId: number, text: string) => {
      this.edits.push({ text });
      return { message_id: _messageId } as unknown;
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
