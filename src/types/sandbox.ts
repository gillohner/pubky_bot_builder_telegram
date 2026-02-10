// src/types/sandbox.ts
// Sandbox related shared types.
// Capabilities requested for sandbox execution (currently mostly timeouts; net reserved)
export interface SandboxCaps {
	net?: string[];
	timeoutMs?: number;
	/** Whether the service uses npm packages (affects sandbox permissions) */
	hasNpm?: boolean;
}

// The sandboxed service runtime (sdk/runtime.ts) expects a payload shape that matches
// SandboxPayload from services types: { event: {..}, ctx: {..}, manifest? }
// To avoid a circular import we redefine a minimal structural type here and alias it.
export interface SandboxExecuteEvent {
	type: string;
	token?: string;
	data?: string;
	message?: unknown;
	state?: Record<string, unknown>;
	stateVersion?: number;
}
export interface ExecutePayload {
	event: SandboxExecuteEvent;
	ctx: { chatId: string; userId: string; serviceConfig?: Record<string, unknown> };
	manifest?: { schemaVersion: number };
}

export interface SandboxResult<T = unknown> {
	ok: boolean;
	value?: T;
	error?: string;
}
