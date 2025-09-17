// src/types/services.ts
// Shared service-related type definitions
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
export interface ServiceReplyAudio extends ServiceReplyBase {
	kind: "audio";
	audio: string;
	duration?: number;
	title?: string;
	performer?: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyVideo extends ServiceReplyBase {
	kind: "video";
	video: string;
	duration?: number;
	width?: number;
	height?: number;
	thumbnail?: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyDocument extends ServiceReplyBase {
	kind: "document";
	document: string;
	filename?: string;
	mimeType?: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyLocation extends ServiceReplyBase {
	kind: "location";
	latitude: number;
	longitude: number;
	title?: string;
	address?: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyContact extends ServiceReplyBase {
	kind: "contact";
	phoneNumber: string;
	firstName: string;
	lastName?: string;
	userId?: string;
	options?: Record<string, unknown>;
}
export interface ServiceReplyUI extends ServiceReplyBase {
	kind: "ui";
	text?: string;
	ui: unknown;
	uiType: "keyboard" | "menu" | "card" | "carousel" | "form";
	options?: Record<string, unknown>;
}
export type ServiceResponse =
	| ServiceReplyMessage
	| ServiceReplyEdit
	| ServiceReplyNone
	| ServiceReplyError
	| ServiceReplyPhoto
	| ServiceReplyDelete
	| ServiceReplyAudio
	| ServiceReplyVideo
	| ServiceReplyDocument
	| ServiceReplyLocation
	| ServiceReplyContact
	| ServiceReplyUI;
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
	ctx: {
		chatId: string;
		userId: string;
		serviceConfig?: Record<string, unknown>;
		routeMeta?: { id: string; command: string; description?: string };
		datasets?: Record<string, unknown>;
	};
	manifest?: SandboxManifest;
}
export interface SandboxExecuteResult {
	ok: boolean;
	response?: ServiceResponse;
	error?: string;
	state?: Record<string, unknown>;
}
