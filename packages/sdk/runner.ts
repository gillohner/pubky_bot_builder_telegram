// sdk/runner.ts
// Service runtime entrypoint (sandbox harness)
import { error } from "./responses/factory.ts";
import type { DefinedService } from "./service.ts";
import type { GenericEvent } from "./events.ts";

interface RawPayload {
	event: GenericEvent;
	ctx: {
		chatId?: string;
		userId?: string;
		serviceConfig?: Record<string, unknown>;
		routeMeta?: { id: string; command: string; description?: string };
		datasets?: Record<string, unknown>;
	};
}

function assertEvent(e: unknown): asserts e is GenericEvent {
	if (!e || typeof e !== "object" || !("type" in (e as { type?: unknown }))) {
		throw new Error("Invalid event");
	}
	const t = (e as { type?: unknown }).type;
	if (t !== "command" && t !== "callback" && t !== "message") throw new Error("Unknown event type");
}

export async function runService(svc: DefinedService) {
	let raw: string;
	try {
		raw = await new Response(Deno.stdin.readable).text();
	} catch {
		await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(error("stdin read error"))));
		return;
	}
	let payload: RawPayload;
	try {
		payload = JSON.parse(raw);
	} catch {
		await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(error("payload parse error"))));
		return;
	}
	try {
		assertEvent(payload.event);
	} catch (err) {
		await Deno.stdout.write(
			new TextEncoder().encode(JSON.stringify(error((err as Error).message))),
		);
		return;
	}
	const event = payload.event;
	const evtAny = event as {
		state?: Record<string, unknown>;
		stateVersion?: number;
		data?: string;
		message?: unknown;
	};
	// Derive runtime route metadata (host-provided) for automatic manifest alignment
	const routeMeta = payload.ctx?.routeMeta;
	if (routeMeta) {
		// Only override if service opted-in via placeholder tokens to avoid mutating real manifests.
		const placeholder = "__runtime__";
		try {
			if (svc.manifest.id === placeholder) {
				// manifest object itself is mutable even if parent service was frozen.
				(svc.manifest as { id: string }).id = routeMeta.id;
			}
			if (svc.manifest.command === placeholder) {
				(svc.manifest as { command: string }).command = routeMeta.command;
			}
			if (svc.manifest.description === placeholder && routeMeta.description) {
				(svc.manifest as { description?: string }).description = routeMeta.description;
			}
		} catch (_err) {
			// Swallow mutation errors; service will fall back to placeholder values.
		}
	}

	const ctxBase = {
		chatId: payload.ctx?.chatId ?? "",
		userId: payload.ctx?.userId ?? "",
		serviceConfig: payload.ctx?.serviceConfig,
		state: evtAny.state,
		stateVersion: evtAny.stateVersion,
		routeMeta,
		datasets: payload.ctx?.datasets,
	};
	let resp;
	try {
		if (event.type === "command") {
			resp = await svc.handlers.command({ ...ctxBase, type: "command" });
		} else if (event.type === "callback") {
			resp = await svc.handlers.callback({ ...ctxBase, type: "callback", data: evtAny.data ?? "" });
		} else if (event.type === "message") {
			resp = await svc.handlers.message({ ...ctxBase, type: "message", message: evtAny.message });
		} else resp = error("unknown event type");
	} catch (err) {
		resp = error((err as Error).message || "service error");
	}
	await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(resp)));
}
