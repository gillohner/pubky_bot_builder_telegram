// src/types/services.ts
// Shared service-related type definitions (extracted from core/service_types.ts)
export type ServiceKind =
	| "single_command"
	| "command_flow"
	| "listener"
	| "periodic_command";

export const SERVICE_PROTOCOL_SCHEMA_VERSION = 1 as const;

export type ServiceCapability =
	| "net"
	| "crypto"
	| "timers";

export interface ServiceCapabilityRequest {
	capability: ServiceCapability;
	scope?: string[];
}
export interface ServiceManifest {
	schemaVersion: number;
	capabilities?: ServiceCapabilityRequest[];
}
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

export interface ServiceReplyBase {
	state?: StateDirective;
	deleteTrigger?: boolean;
}
export interface ServiceReplyMessage extends ServiceReplyBase {
	kind: "reply";
	text: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyEdit extends ServiceReplyBase {
	kind: "edit";
	text: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyNone extends ServiceReplyBase {
	kind: "none";
}
export interface ServiceReplyError extends ServiceReplyBase {
	kind: "error";
	message: string;
}
export interface ServiceReplyPhoto extends ServiceReplyBase {
	kind: "photo";
	photo: string;
	caption?: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyDelete extends ServiceReplyBase {
	kind: "delete";
	fallbackText?: string;
	options?: Record<string, unknown>;
}
export type ServiceResponse =
	| ServiceReplyMessage
	| ServiceReplyEdit
	| ServiceReplyNone
	| ServiceReplyError
	| ServiceReplyPhoto
	| ServiceReplyDelete;
export interface DispatcherResult {
	response: ServiceResponse | null;
}
export interface SandboxExecuteEventCommand {
	type: "command";
	token: string;
	state?: Record<string, unknown>;
	stateVersion?: number;
}
export interface SandboxExecuteEventMessage {
	type: "message";
	message?: unknown;
	state?: Record<string, unknown>;
	stateVersion?: number;
}
export interface SandboxExecuteEventCallback {
	type: "callback";
	data: string;
	state?: Record<string, unknown>;
	stateVersion?: number;
}
export type SandboxExecuteEvent =
	| SandboxExecuteEventCommand
	| SandboxExecuteEventMessage
	| SandboxExecuteEventCallback;
export interface SandboxManifest {
	schemaVersion: number;
}
export interface SandboxPayload {
	event: SandboxExecuteEvent;
	ctx: { chatId: string; userId: string; serviceConfig?: Record<string, unknown> };
	manifest?: SandboxManifest;
}
export interface SandboxExecuteResult {
	ok: boolean;
	response?: ServiceResponse;
	error?: string;
	state?: Record<string, unknown>;
}
