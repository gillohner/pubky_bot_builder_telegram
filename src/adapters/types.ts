// src/adapters/types.ts
// Platform adapter abstraction. For now only telegram implementation.
import type { ServiceResponse } from "@core/service_types.ts";

export interface AdapterApplyContext {
	// Opaque platform-specific context object (e.g., grammY Context for Telegram)
	platformCtx: unknown;
}

export interface PlatformAdapter {
	id: string; // e.g. 'telegram'
	applyResponse(ctx: AdapterApplyContext, resp: ServiceResponse | null): Promise<void>;
}

export type AdapterRegistry = Record<string, PlatformAdapter>;
