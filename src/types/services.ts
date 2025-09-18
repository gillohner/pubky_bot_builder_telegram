// Deprecated shim: all service-related types moved to SDK (@sdk/mod.ts).
// This file will be removed in a future release. Prefer importing directly from the SDK.
export { SERVICE_PROTOCOL_SCHEMA_VERSION } from "@sdk/mod.ts";
export type {
	DispatcherResult,
	SandboxExecuteEvent,
	SandboxExecuteEventCallback,
	SandboxExecuteEventCommand,
	SandboxExecuteEventMessage,
	SandboxExecuteResult,
	SandboxManifest,
	SandboxPayload,
	ServiceCapability,
	ServiceCapabilityRequest,
	ServiceManifestProtocol as ServiceManifest,
} from "@sdk/mod.ts";
export type { ServiceKind, ServiceResponse, StateDirective } from "@sdk/mod.ts";
