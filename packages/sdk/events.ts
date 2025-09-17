// sdk/events.ts
// Event context & event union types.
import type { StateDirective } from "./state.ts";

export interface ServiceContext {
	chatId: string;
	userId: string;
	language?: string;
	serviceConfig?: Record<string, unknown>;
	state?: Record<string, unknown>;
	stateVersion?: number;
	t?: (key: string, params?: Record<string, unknown>) => string;
	/** Route metadata (id/command/description) injected by host. */
	routeMeta?: { id: string; command: string; description?: string };
	/** Resolved dataset objects (JSON) keyed by dataset name. */
	datasets?: Record<string, unknown>;
}

export type CommandEvent = { type: "command" } & ServiceContext;
export type CallbackEvent = { type: "callback"; data: string } & ServiceContext;
export type MessageEvent = { type: "message"; message: unknown } & ServiceContext;
export type GenericEvent = CommandEvent | CallbackEvent | MessageEvent;

export type { StateDirective };
