// sdk/service.ts
// Service definition related types & helper.
import type { CallbackEvent, CommandEvent, MessageEvent } from "./events.ts";
import type { ServiceResponse } from "./responses/types.ts";

export type ServiceKind = "single_command" | "command_flow" | "listener";

export interface ServiceDefinition {
	id: string;
	version: string;
	kind: ServiceKind;
	command: string; // canonical token (without leading '/')
	description?: string;
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

export function defineService(def: ServiceDefinition): DefinedService {
	return Object.freeze({
		...def,
		manifest: {
			id: def.id,
			version: def.version,
			kind: def.kind,
			command: def.command,
			description: def.description,
			schemaVersion: SERVICE_SDK_SCHEMA_VERSION,
		},
	});
}
