// Adapter shim: previous module name preserved for backward compatibility.
import type { Context } from "grammy";
import type { ServiceResponse } from "@sdk/mod.ts";
import { defaultAdapter } from "@adapters/registry.ts";

export async function applyServiceResponse(
	ctx: Context,
	resp: ServiceResponse | null,
): Promise<void> {
	const adapter = defaultAdapter();
	await adapter.applyResponse({ platformCtx: ctx }, resp);
}
