// sdk/runtime.ts
// Lightweight inlined service SDK. This file will be concatenated with each service
// source when building the routing snapshot so sandboxed execution requires no
// filesystem permissions (data URL module). Keep it dependency-free and self-contained.

// -------------------------- Types -----------------------------------------
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
	state?: StateDirective;
	deleteTrigger?: boolean;
}
export interface ReplyMessage extends BaseReply {
	kind: "reply";
	text: string;
	options?: Record<string, unknown>;
}
export interface EditMessage extends BaseReply {
	kind: "edit";
	text: string;
	options?: Record<string, unknown>;
}
export interface NoneMessage extends BaseReply {
	kind: "none";
}
export interface ErrorMessage extends BaseReply {
	kind: "error";
	message: string;
}
export interface PhotoMessage extends BaseReply {
	kind: "photo";
	photo: string;
	caption?: string;
	options?: Record<string, unknown>;
}
export interface DeleteMessage extends BaseReply {
	kind: "delete";
	fallbackText?: string;
	options?: Record<string, unknown>;
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
	// datasets, locale, timezone reserved for future
}

export type CommandEvent = { type: "command" } & ServiceContext;
export type CallbackEvent = { type: "callback"; data: string } & ServiceContext;
export type MessageEvent = { type: "message"; message: unknown } & ServiceContext;
export type GenericEvent = CommandEvent | CallbackEvent | MessageEvent;

export interface ServiceDefinition {
	id: string; // stable internal service id
	version: string; // semver
	kind: ServiceKind;
	command?: string; // command token without '/'
	handlers: {
		command?: (ev: CommandEvent) => ServiceResponse | Promise<ServiceResponse>;
		callback?: (ev: CallbackEvent) => ServiceResponse | Promise<ServiceResponse>;
		message?: (ev: MessageEvent) => ServiceResponse | Promise<ServiceResponse>;
	};
	description?: string;
	author?: string;
}

export interface DefinedService {
	manifest: {
		id: string;
		version: string;
		kind: ServiceKind;
		command?: string;
		description?: string;
		author?: string;
		schemaVersion: number;
	};
	impl: ServiceDefinition;
}

export const SERVICE_SDK_SCHEMA_VERSION = 1 as const;

export function defineService(def: ServiceDefinition): DefinedService {
	return {
		manifest: {
			id: def.id,
			version: def.version,
			kind: def.kind,
			command: def.command,
			description: def.description,
			author: def.author,
			schemaVersion: SERVICE_SDK_SCHEMA_VERSION,
		},
		impl: def,
	};
}

// ----------------------- Helper factories ---------------------------------
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
export function none(opts?: { state?: StateDirective; deleteTrigger?: boolean }): NoneMessage {
	return { kind: "none", state: opts?.state, deleteTrigger: opts?.deleteTrigger };
}
export function errorResp(message: string): ErrorMessage {
	return { kind: "error", message };
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
export function deleteResp(
	opts?: { fallbackText?: string; options?: Record<string, unknown>; state?: StateDirective },
): DeleteMessage {
	return {
		kind: "delete",
		fallbackText: opts?.fallbackText,
		options: opts?.options,
		state: opts?.state,
	};
}

// State helpers
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
};

// ------------------------ Runtime Harness ---------------------------------
interface SandboxInboundPayload {
	event: {
		type: string;
		token?: string;
		data?: string;
		message?: unknown;
		state?: Record<string, unknown>;
		stateVersion?: number;
	};
	ctx: { chatId: string; userId: string; serviceConfig?: Record<string, unknown> };
	manifest?: { schemaVersion: number };
}

async function readAll(): Promise<string> {
	const chunks: Uint8Array[] = [];
	for await (
		const c of (Deno.stdin as unknown as { readable: ReadableStream<Uint8Array> }).readable
	) chunks.push(c);
	const total = chunks.reduce((n, c) => n + c.length, 0);
	const buf = new Uint8Array(total);
	let o = 0;
	for (const c of chunks) {
		buf.set(c, o);
		o += c.length;
	}
	return new TextDecoder().decode(buf).trim();
}

export async function runService(svc: DefinedService): Promise<void> {
	const raw = await readAll();
	let payload: SandboxInboundPayload | null = null;
	try {
		payload = raw ? JSON.parse(raw) as SandboxInboundPayload : null;
	} catch { /* ignore */ }
	if (!payload) {
		console.log(JSON.stringify(none()));
		return;
	}
	const ev = payload.event;
	const baseCtx: ServiceContext = {
		chatId: payload.ctx.chatId,
		userId: payload.ctx.userId,
		serviceConfig: payload.ctx.serviceConfig,
		state: ev.state,
		stateVersion: ev.stateVersion,
	};
	let result: ServiceResponse = none();
	try {
		if (ev.type === "command" && svc.impl.handlers.command) {
			result = await svc.impl.handlers.command({ type: "command", ...baseCtx });
		} else if (ev.type === "callback" && svc.impl.handlers.callback) {
			result = await svc.impl.handlers.callback({
				type: "callback",
				data: ev.data || "",
				...baseCtx,
			});
		} else if (ev.type === "message" && svc.impl.handlers.message) {
			result = await svc.impl.handlers.message({
				type: "message",
				message: ev.message,
				...baseCtx,
			});
		}
	} catch (err) {
		result = errorResp((err as Error).message || "service error");
	}
	console.log(JSON.stringify(result));
}

// No side effects when imported; services will call runService explicitly after definition in concatenated bundle.
