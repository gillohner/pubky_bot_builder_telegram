// src/types/routing.ts
// Routing snapshot & route type definitions extracted from snapshot builder.
export interface BaseRoute {
	serviceId: string;
	bundleHash: string;
	config?: Record<string, unknown>;
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
