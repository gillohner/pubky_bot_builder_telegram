// Moved runtime from src/sdk/runtime.ts into pbb_sdk for unified public SDK namespace.
// (Original file path: src/sdk/runtime.ts)
// NOTE: Keep implementation identical; only path changes.
export type ServiceKind = "single_command" | "command_flow" | "listener";

export interface StateDirectiveClear {
	op: "clear";
}
export interface StateDirectiveReplace {
	op: "replace";
	value: Record<string, unknown>;
}
export interface StateDirectiveMerge {
	op: "merge";
	value: Record<string, unknown>;
}
export type StateDirective = StateDirectiveClear | StateDirectiveReplace | StateDirectiveMerge;

export interface BaseReply {
	kind: string;
	text?: string;
	options?: Record<string, unknown>;
	state?: StateDirective;
	deleteTrigger?: boolean;
}
export interface ReplyMessage extends BaseReply {
	kind: "reply";
}
export interface EditMessage extends BaseReply {
	kind: "edit";
}
export interface NoneMessage extends BaseReply {
	kind: "none";
}
export interface ErrorMessage extends BaseReply {
	kind: "error";
}
export interface PhotoMessage extends BaseReply {
	kind: "photo";
	photo: string;
	caption?: string;
}
export interface DeleteMessage extends BaseReply {
	kind: "delete";
}
export type ServiceResponse =
	| ReplyMessage
	| EditMessage
	| NoneMessage
	| ErrorMessage
	| PhotoMessage
	| DeleteMessage;

export interface ServiceContext {
	chatId: string;
	userId: string;
	serviceConfig?: Record<string, unknown>;
	state?: Record<string, unknown>;
	stateVersion?: number;
}

export type CommandEvent = { type: "command" } & ServiceContext;
export type CallbackEvent = { type: "callback"; data: string } & ServiceContext;
export type MessageEvent = { type: "message"; message: unknown } & ServiceContext;
export type GenericEvent = CommandEvent | CallbackEvent | MessageEvent;

export interface ServiceDefinition {
	id: string;
	version: string;
	kind: ServiceKind;
	command: string; // canonical token (without leading /)
	description?: string;
	handlers: {
		command: (ev: CommandEvent) => ServiceResponse | Promise<ServiceResponse>;
		callback: (ev: CallbackEvent) => ServiceResponse | Promise<ServiceResponse>;
		message: (ev: MessageEvent) => ServiceResponse | Promise<ServiceResponse>;
	};
}

export interface ServiceManifest {
	/** Unique service id */
	id: string;
	/** Semver-like version */
	version: string;
	/** Kind of service (single_command | command_flow | listener) */
	kind: ServiceKind;
	/** Canonical command token (still present even for listener for uniformity) */
	command: string;
	/** Optional description */
	description?: string;
	/** Frozen schema version for tooling/tests */
	schemaVersion: number;
}

export interface DefinedService extends ServiceDefinition {
	/** Lightweight manifest (stable shape consumed by host/tests) */
	manifest: ServiceManifest;
}

export const SERVICE_SDK_SCHEMA_VERSION = 1 as const;

export function defineService(def: ServiceDefinition): DefinedService {
	// Attach stable manifest projection (avoids test edits per service)
	const manifest: ServiceManifest = {
		id: def.id,
		version: def.version,
		kind: def.kind,
		command: def.command,
		description: def.description,
		schemaVersion: SERVICE_SDK_SCHEMA_VERSION,
	};
	return Object.freeze({ ...def, manifest });
}

export function reply(
	text: string,
	opts?: { options?: Record<string, unknown>; state?: StateDirective; deleteTrigger?: boolean },
): ReplyMessage {
	return {
		kind: "reply",
		text,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}
export function edit(
	text: string,
	opts?: { options?: Record<string, unknown>; state?: StateDirective; deleteTrigger?: boolean },
): EditMessage {
	return {
		kind: "edit",
		text,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}
export function none(): NoneMessage {
	return { kind: "none" };
}
export function error(text: string): ErrorMessage {
	return { kind: "error", text };
}
export function photoResp(
	photo: string,
	opts?: {
		caption?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): PhotoMessage {
	return {
		kind: "photo",
		photo,
		caption: opts?.caption,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}
export function deleteResp(): DeleteMessage {
	return { kind: "delete" };
}

export const state = {
	replace(value: Record<string, unknown>): StateDirectiveReplace {
		return { op: "replace", value };
	},
	merge(value: Record<string, unknown>): StateDirectiveMerge {
		return { op: "merge", value };
	},
	clear(): StateDirectiveClear {
		return { op: "clear" };
	},
} as const;

// Service runtime entrypoint for sandbox.
export async function runService(svc: DefinedService) {
	// Parse payload from stdin (snapshot host sends JSON)
	const raw = await new Response(Deno.stdin.readable).text();
	const payload = JSON.parse(raw);
	const event = payload.event as GenericEvent;
	const ctxBase = {
		chatId: payload.ctx.chatId,
		userId: payload.ctx.userId,
		serviceConfig: payload.ctx.serviceConfig,
		state: event.state,
		stateVersion: event.stateVersion,
	};
	let resp: ServiceResponse | undefined;
	try {
		if (event.type === "command") {
			resp = await svc.handlers.command({ ...ctxBase, type: "command" });
		} else if (event.type === "callback") {
			resp = await svc.handlers.callback({
				...ctxBase,
				type: "callback",
				data: (event as CallbackEvent).data,
			});
		} else if (event.type === "message") {
			resp = await svc.handlers.message({
				...ctxBase,
				type: "message",
				message: (event as MessageEvent).message,
			});
		} else {
			resp = error("unknown event type");
		}
	} catch (err) {
		resp = error((err as Error).message || "service error");
	}
	await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(resp)));
}
