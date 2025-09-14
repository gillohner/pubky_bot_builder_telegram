// src/core/dispatch/dispatcher.ts
// Moved from src/core/dispatcher.ts
import { buildSnapshot } from "../snapshot/snapshot.ts";
import { sandboxHost } from "../sandbox/host.ts";
import { log } from "../util/logger.ts";
import {
  DispatcherResult,
  ServiceResponse,
  SandboxPayload,
  SERVICE_PROTOCOL_SCHEMA_VERSION,
} from "../service_types.ts";

type BaseCtx = { chatId: string; userId: string };
type CommandEvent = { kind: "command"; command: string; ctx: BaseCtx };
type CallbackEvent = { kind: "callback"; data: string; ctx: BaseCtx };
type MessageEvent = { kind: "message"; message: unknown; ctx: BaseCtx };
export type DispatchEvent = CommandEvent | CallbackEvent | MessageEvent;

export async function dispatch(evt: DispatchEvent): Promise<DispatcherResult> {
  if (evt.kind === "command") {
    const snapshot = await buildSnapshot(evt.ctx.chatId);
    const route = snapshot.commands[evt.command];
    if (!route) {
      log.debug("dispatch.miss", { command: evt.command });
      return { response: null };
    }
    const payload: SandboxPayload = {
      event: { type: "command", token: evt.command },
      ctx: {
        chatId: evt.ctx.chatId,
        userId: evt.ctx.userId,
        serviceConfig: route.config,
      },
      manifest: { schemaVersion: SERVICE_PROTOCOL_SCHEMA_VERSION },
    };
    const res = await sandboxHost.run<ServiceResponse>(route.entry, payload, {
      timeoutMs: 2000,
    });
    if (!res.ok) {
      log.error("sandbox.command.error", {
        command: evt.command,
        error: res.error,
      });
      return {
        response: { kind: "error", message: res.error ?? "sandbox error" },
      };
    }
    log.debug("sandbox.command.ok", {
      command: evt.command,
      response: res.value,
    });
    return { response: res.value ?? { kind: "none" } };
  }
  if (evt.kind === "callback") {
    log.debug("dispatch.callback.noop");
    return { response: null };
  }
  if (evt.kind === "message") {
    const snapshot = await buildSnapshot(evt.ctx.chatId);
    for (const listener of snapshot.listeners) {
      const payload: SandboxPayload = {
        event: { type: "message", message: evt.message },
        ctx: { chatId: evt.ctx.chatId, userId: evt.ctx.userId },
        manifest: { schemaVersion: SERVICE_PROTOCOL_SCHEMA_VERSION },
      };
      const res = await sandboxHost.run<ServiceResponse>(
        listener.entry,
        payload,
        { timeoutMs: 1000 }
      );
      if (!res.ok) {
        log.warn("sandbox.listener.error", {
          error: res.error,
          serviceId: listener.serviceId,
        });
        continue;
      }
      if (res.value && res.value.kind !== "none") {
        log.debug("sandbox.listener.ok", {
          serviceId: listener.serviceId,
          kind: res.value.kind,
        });
        return { response: res.value };
      }
    }
    return { response: null };
  }
  return { response: null };
}
