// src/core/dispatch/dispatcher.ts
// Moved from src/core/dispatcher.ts
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { sandboxHost } from "@core/sandbox/host.ts";
import { getServiceBundle } from "@core/config/store.ts";
import { log } from "@core/util/logger.ts";
import {
	applyStateDirective,
	clearActiveFlow,
	getActiveFlow,
	getServiceState,
	setActiveFlow,
} from "@core/state/state.ts";
import { DispatcherResult, ServiceResponse } from "@core/service_types.ts";
import type { SandboxPayload } from "@schema/services.ts";
import type { ExecutePayload } from "@schema/sandbox.ts";

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
		// Load existing state (if any)
		const existing = getServiceState({
			chatId: evt.ctx.chatId,
			userId: evt.ctx.userId,
			serviceId: route.serviceId,
		});
		const payload: SandboxPayload = {
			event: { type: "command", token: evt.command, state: existing?.value },
			ctx: { chatId: evt.ctx.chatId, userId: evt.ctx.userId, serviceConfig: route.config },
			manifest: { schemaVersion: 1 },
		};
		const bundle = getServiceBundle(route.bundleHash);
		if (!bundle) {
			log.error("dispatch.bundle.missing", { bundleHash: route.bundleHash });
			return { response: { kind: "error", message: "bundle missing" } } as DispatcherResult;
		}
		// Pass the payload directly (matches sdk runtime expectation)
		const res = await sandboxHost.run<ServiceResponse>(
			bundle.data_url,
			payload as unknown as ExecutePayload,
			{
				timeoutMs: 2000,
			},
		);
		if (!res.ok) {
			log.error("sandbox.command.error", {
				command: evt.command,
				error: res.error,
			});
			return {
				response: { kind: "error", message: res.error ?? "sandbox error" },
			};
		}
		log.debug("sandbox.command.ok", { command: evt.command });
		// Apply state directive if present
		if (res.value?.state) {
			const after = applyStateDirective({
				directive: res.value.state,
				chatId: evt.ctx.chatId,
				userId: evt.ctx.userId,
				serviceId: route.serviceId,
			});
			// Manage active flow pointer
			if (route.kind === "command_flow") {
				if (res.value.state.op === "clear") {
					clearActiveFlow(evt.ctx.chatId, evt.ctx.userId);
				} else {
					setActiveFlow(evt.ctx.chatId, evt.ctx.userId, route.serviceId);
				}
			}
			log.debug("dispatch.state.applied", {
				serviceId: route.serviceId,
				op: res.value.state.op,
				version: after?.version,
			});
		} else if (route.kind === "command_flow") {
			// If command invoked a flow but did not emit a state directive and no existing state, mark active
			const existing = getServiceState({
				chatId: evt.ctx.chatId,
				userId: evt.ctx.userId,
				serviceId: route.serviceId,
			});
			if (existing) {
				setActiveFlow(evt.ctx.chatId, evt.ctx.userId, route.serviceId);
			}
		}
		return { response: res.value ?? { kind: "none" } };
	}
	if (evt.kind === "callback") {
		const snapshot = await buildSnapshot(evt.ctx.chatId);
		// Expected format: svc:<serviceId>|<payload>
		let serviceId: string | undefined;
		let payloadData = evt.data;
		if (payloadData.startsWith("svc:")) {
			const pipeIdx = payloadData.indexOf("|");
			if (pipeIdx > 4) {
				serviceId = payloadData.slice(4, pipeIdx);
				payloadData = payloadData.slice(pipeIdx + 1);
			} else {
				serviceId = payloadData.slice(4);
				payloadData = "";
			}
		}
		if (!serviceId) {
			log.debug("dispatch.callback.unparsed", { data: evt.data });
			return { response: null };
		}
		const route = Object.values(snapshot.commands).find(
			(r) => r.serviceId === serviceId,
		);
		if (!route) {
			log.debug("dispatch.callback.unknown_service", { serviceId });
			return { response: null };
		}
		const existing = getServiceState({
			chatId: evt.ctx.chatId,
			userId: evt.ctx.userId,
			serviceId: route.serviceId,
		});
		const payload: SandboxPayload = {
			event: { type: "callback", data: evt.data, state: existing?.value },
			ctx: { chatId: evt.ctx.chatId, userId: evt.ctx.userId, serviceConfig: route.config },
			manifest: { schemaVersion: 1 },
		};
		const bundle = getServiceBundle(route.bundleHash);
		if (!bundle) {
			log.error("dispatch.bundle.missing", { bundleHash: route?.bundleHash });
			return { response: { kind: "error", message: "bundle missing" } };
		}
		const res = await sandboxHost.run<ServiceResponse>(
			bundle.data_url,
			payload as unknown as ExecutePayload,
			{
				timeoutMs: 2000,
			},
		);
		if (!res.ok) {
			log.error("sandbox.callback.error", { error: res.error, serviceId });
			return {
				response: { kind: "error", message: res.error ?? "sandbox error" },
			};
		}
		if (res.value?.state) {
			const after = applyStateDirective({
				directive: res.value.state,
				chatId: evt.ctx.chatId,
				userId: evt.ctx.userId,
				serviceId: route.serviceId,
			});
			if (route.kind === "command_flow") {
				if (res.value.state.op === "clear") {
					clearActiveFlow(evt.ctx.chatId, evt.ctx.userId);
				} else setActiveFlow(evt.ctx.chatId, evt.ctx.userId, route.serviceId);
			}
			log.debug("dispatch.callback.state", {
				serviceId: route.serviceId,
				op: res.value.state.op,
				version: after?.version,
			});
		}
		log.debug("dispatch.callback.ok", { serviceId, kind: res.value?.kind });
		return { response: res.value ?? { kind: "none" } };
	}
	if (evt.kind === "message") {
		const snapshot = await buildSnapshot(evt.ctx.chatId);
		const active = getActiveFlow(evt.ctx.chatId, evt.ctx.userId);
		if (active) {
			// Route directly to active flow service (command_flow)
			const route = Object.values(snapshot.commands).find(
				(r) => r.serviceId === active.serviceId && r.kind === "command_flow",
			);
			if (route) {
				const existing = getServiceState({
					chatId: evt.ctx.chatId,
					userId: evt.ctx.userId,
					serviceId: route.serviceId,
				});
				const payload: SandboxPayload = {
					event: { type: "message", message: evt.message, state: existing?.value },
					ctx: { chatId: evt.ctx.chatId, userId: evt.ctx.userId, serviceConfig: route.config },
					manifest: { schemaVersion: 1 },
				};
				const bundle = getServiceBundle(route.bundleHash);
				if (!bundle) {
					log.error("dispatch.bundle.missing", { bundleHash: route.bundleHash });
					return { response: { kind: "error", message: "bundle missing" } };
				}
				const res = await sandboxHost.run<ServiceResponse>(
					bundle.data_url,
					payload as unknown as ExecutePayload,
					{
						timeoutMs: 2000,
					},
				);
				if (!res.ok) {
					log.error("sandbox.flow.message.error", {
						error: res.error,
						serviceId: route.serviceId,
					});
					return {
						response: { kind: "error", message: res.error ?? "sandbox error" },
					};
				}
				if (res.value?.state) {
					const after = applyStateDirective({
						directive: res.value.state,
						chatId: evt.ctx.chatId,
						userId: evt.ctx.userId,
						serviceId: route.serviceId,
					});
					if (res.value.state.op === "clear") {
						clearActiveFlow(evt.ctx.chatId, evt.ctx.userId);
					}
					log.debug("dispatch.flow.state", {
						serviceId: route.serviceId,
						op: res.value.state.op,
						version: after?.version,
					});
				}
				return { response: res.value ?? { kind: "none" } };
			}
		}
		// Fallback to listeners
		for (const listener of snapshot.listeners) {
			const payload: SandboxPayload = {
				event: { type: "message", message: evt.message },
				ctx: { chatId: evt.ctx.chatId, userId: evt.ctx.userId, serviceConfig: listener.config },
				manifest: { schemaVersion: 1 },
			};
			const bundle = getServiceBundle(listener.bundleHash);
			if (!bundle) {
				log.error("dispatch.listener.bundle.missing", { bundleHash: listener.bundleHash });
				continue;
			}
			const res = await sandboxHost.run<ServiceResponse>(
				bundle.data_url,
				payload as unknown as ExecutePayload,
				{
					timeoutMs: 1000,
				},
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
