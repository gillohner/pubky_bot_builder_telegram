// sdk/service.ts
// Service definition related types & helper.
import type { CallbackEvent, CommandEvent, MessageEvent } from "./events.ts";
import type { ServiceResponse } from "./responses/types.ts";

export type ServiceKind = "single_command" | "command_flow" | "listener" | "periodic_command";

export interface ServiceDefinition {
	id?: string; // optional - injected if omitted
	version: string;
	kind: ServiceKind;
	command?: string; // optional - injected if omitted (non-listener kinds only)
	description?: string; // optional - injected if omitted
	handlers: {
		command: (ev: CommandEvent) => ServiceResponse | Promise<ServiceResponse>;
		callback: (ev: CallbackEvent) => ServiceResponse | Promise<ServiceResponse>;
		message: (ev: MessageEvent) => ServiceResponse | Promise<ServiceResponse>;
	};
}

export interface ServiceManifest {
	id: string;
	version: string;
	kind: ServiceKind;
	command: string;
	description?: string;
	schemaVersion: number;
}

export interface DefinedService extends ServiceDefinition {
	manifest: ServiceManifest;
}

export const SERVICE_SDK_SCHEMA_VERSION = 1 as const;

const AUTO_SENTINEL = "__auto__" as const;

export function defineService(def: ServiceDefinition): DefinedService {
	const id = def.id && def.id.length > 0 ? def.id : AUTO_SENTINEL;
	// Listener services may legitimately omit command; others get sentinel if missing.
	const command = def.kind === "listener"
		? (def.command && def.command.length > 0 ? def.command : AUTO_SENTINEL)
		: (def.command && def.command.length > 0 ? def.command : AUTO_SENTINEL);
	const description = def.description; // optional – may be injected later
	return Object.freeze({
		...def,
		id, // Preserve direct access if user relied on it pre-manifest (non-breaking)
		command,
		description,
		manifest: {
			id,
			version: def.version,
			kind: def.kind,
			command,
			description,
			schemaVersion: SERVICE_SDK_SCHEMA_VERSION,
		},
	}) as DefinedService;
}

export { AUTO_SENTINEL }; // re-exported for tests if needed
