// src/core/service_types.ts
// Canonical service type interfaces used between dispatcher, sandbox payloads,
// and middleware translation. These are intentionally narrow and will evolve
// as more features (state, datasets, flows, periodic) are implemented.

// ---------------------------------------------------------------------------
// Service kinds enumerate the high-level execution pattern a service follows.
// Additional kinds will be introduced as orchestration (flows, listeners, etc.)
// mature. Keeping this narrow now avoids premature complexity.
export type ServiceKind =
  | "single_command"
  | "command_flow"
  | "listener"
  | "periodic_command";

// Schema version of the service <-> host protocol. Increment when a breaking
// change to the payload or response contract is introduced. Host side can then
// branch or provide shims for backward compatibility.
export const SERVICE_PROTOCOL_SCHEMA_VERSION = 1 as const;

// Capability model ---------------------------------------------------------
// A minimal, additive list of capabilities a service may request. The host
// (dispatcher / sandbox launcher) will translate these into concrete Deno
// permission flags or injected helpers. Purposefully coarse-grained to reduce
// fingerprinting & complexity early on.
export type ServiceCapability =
  | "net" // Outbound network access
  | "crypto" // Access to subtle crypto / randomness
  | "timers"; // Long running timers / intervals (for periodic kinds)

export interface ServiceCapabilityRequest {
  capability: ServiceCapability;
  // Optional fine-grained scope (e.g. hostnames, path globs, env var names)
  scope?: string[];
}

// Each service can declare an array of requested capabilities. Enforcement &
// reduction (principle of least privilege) is performed host side. Snapshot
// builders can also inject defaults (e.g., disallow fs unless explicitly set).
export interface ServiceManifest {
  schemaVersion: number; // aligns with SERVICE_PROTOCOL_SCHEMA_VERSION
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
export type StateDirective =
  | StateDirectiveClear
  | StateDirectiveReplace
  | StateDirectiveMerge;

export interface ServiceReplyBase {
  state?: StateDirective;
  // When true, host should attempt to delete the triggering user/callback message
  // AFTER successfully sending/editing the bot response. Ignored for kinds where
  // message context is unavailable.
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

// New: photo response kind (send a photo / image). The `photo` field accepts
// either a Telegram file_id (string) for reuse, or a remote HTTPS URL that
// Telegram can fetch. (Future: maybe support uploading via multipart.)
export interface ServiceReplyPhoto extends ServiceReplyBase {
  kind: "photo";
  photo: string; // file_id or HTTPS URL
  caption?: string;
  options?: Record<string, unknown>; // reply_markup, parse_mode, etc.
}

// Delete: request deletion of the triggering message (e.g., closing an inline menu)
export interface ServiceReplyDelete extends ServiceReplyBase {
  kind: "delete";
  // Optional fallback reply if deletion fails (e.g., older message not deletable)
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
  response: ServiceResponse | null; // null when no applicable route / ignored event
}

export interface SandboxExecuteEventCommand {
  type: "command";
  token: string; // normalized command token without leading '/'
  state?: Record<string, unknown>; // current persisted state for this (chat,user,service)
  stateVersion?: number; // version for optimistic concurrency (future use)
}
export interface SandboxExecuteEventCallback {
  type: "callback";
  data: string;
  state?: Record<string, unknown>;
  stateVersion?: number;
}
export interface SandboxExecuteEventMessage {
  type: "message";
  message: unknown;
  // For active flow sessions we also supply state similar to command/callback.
  state?: Record<string, unknown>;
  stateVersion?: number;
}
export type SandboxExecuteEvent =
  | SandboxExecuteEventCommand
  | SandboxExecuteEventCallback
  | SandboxExecuteEventMessage;

export interface SandboxExecuteCtx {
  chatId: string;
  userId: string;
  serviceConfig?: Record<string, unknown>;
  // datasets, locale, timezone forthcoming
}

export interface SandboxPayload {
  event: SandboxExecuteEvent;
  ctx: SandboxExecuteCtx;
  // Optional manifest describing requested capabilities / schema version.
  // This allows future host logic to validate or constrain execution.
  manifest?: ServiceManifest;
}
