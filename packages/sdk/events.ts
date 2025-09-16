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
}

export type CommandEvent = { type: "command" } & ServiceContext;
export type CallbackEvent = { type: "callback"; data: string } & ServiceContext;
export type MessageEvent = { type: "message"; message: unknown } & ServiceContext;
export type GenericEvent = CommandEvent | CallbackEvent | MessageEvent;

export type { StateDirective };
