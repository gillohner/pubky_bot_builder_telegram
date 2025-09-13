// src/core/dispatcher.ts
import { buildSnapshot } from "./snapshot.ts";
import { sandboxHost } from "./sandbox.ts";

type BaseCtx = { chatId: string; userId: string };
type CommandEvent = { kind: "command"; command: string; ctx: BaseCtx };
type CallbackEvent = { kind: "callback"; data: string; ctx: BaseCtx };
type MessageEvent = { kind: "message"; message: unknown; ctx: BaseCtx };
export type DispatchEvent = CommandEvent | CallbackEvent | MessageEvent;

// Shape of the minimal response emitted by the mock sandbox service.
interface ServiceReply {
  kind: string;
  text?: string;
}

export async function dispatch(evt: DispatchEvent): Promise<void> {
  if (evt.kind === "command") {
    const snapshot = await buildSnapshot(evt.ctx.chatId);
    const route = snapshot.commands[evt.command];
    if (!route) {
      console.debug("No route for command", evt.command);
      return;
    }
    // Build sandbox event payload aligned with future spec
    const payload = {
      event: { type: "command", token: evt.command },
      ctx: { chatId: evt.ctx.chatId, userId: evt.ctx.userId, serviceConfig: route.config },
    };
    const res = await sandboxHost.run<ServiceReply>(route.entry, payload, {
      timeoutMs: 2000,
    });
    if (!res.ok) {
      console.error("Sandbox error", res.error);
      return;
    }
    console.log("Service response", res.value);
    return;
  }

  // Callback & message events are currently no-ops; placeholder for future logic.
  if (evt.kind === "callback") {
    console.debug("Callback event received (no-op)");
    return;
  }
  if (evt.kind === "message") {
    console.debug("Message event received (no-op)");
    return;
  }
}
