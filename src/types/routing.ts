// src/types/routing.ts
// Routing snapshot & route type definitions extracted from snapshot builder.
export interface RouteMeta {
	id: string;
	command: string;
	description?: string;
}
export interface BaseRoute {
	serviceId: string; // matches service manifest id
	bundleHash: string;
	config?: Record<string, unknown>;
	meta: RouteMeta;
	datasets?: Record<string, unknown>; // placeholder for resolved dataset blobs (json / future binary refs)
	net?: string[]; // allowed network domains for sandbox
}
export interface CommandRoute extends BaseRoute {
	kind: "single_command" | "command_flow";
}
export interface ListenerRoute extends BaseRoute {
	kind: "listener";
}
export type AnyRoute = CommandRoute | ListenerRoute;
export interface RoutingSnapshot {
	commands: Readonly<Record<string, CommandRoute>>;
	listeners: Readonly<ListenerRoute[]>;
	builtAt: number;
	version: number;
	sdkSchemaVersion?: number;
	sourceSig?: string;
	configHash?: string;
	integrity?: string;
}
