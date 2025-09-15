// src/adapters/registry.ts
import { telegramAdapter } from "@adapters/telegram/adapter.ts";
import type { PlatformAdapter } from "@adapters/types.ts";

const adapters: Record<string, PlatformAdapter> = {
	telegram: telegramAdapter,
};

export function getAdapter(id: string): PlatformAdapter | undefined {
	return adapters[id];
}

export function defaultAdapter(): PlatformAdapter {
	return adapters.telegram;
}
