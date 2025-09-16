// src/adapters/types.ts
import type { ServiceResponse } from "@schema/services.ts";

// Platform adapter abstraction. For now only telegram implementation.
export interface AdapterApplyContext {
	// Opaque platform-specific context object (e.g., grammY Context for Telegram)
	platformCtx: unknown;
}

export interface PlatformAdapter {
	id: string; // e.g. 'telegram'
	applyResponse(ctx: AdapterApplyContext, resp: ServiceResponse | null): Promise<void>;
}

export type AdapterRegistry = Record<string, PlatformAdapter>;
