// src/middleware/admin.ts
// Utilities to determine whether a user is an administrator for a chat.
// If BOT_ADMIN_IDS is set, only those users can use admin commands.
// Otherwise falls back to: private chats → everyone is admin; groups → Telegram chat admins.

import { CONFIG } from "@core/config.ts";

// Minimal subset of grammY context we rely on (structural typing)
export interface AdminCheckContextLike {
	chat?: { id: number | string; type: string };
	from?: { id: number };
	getChatAdministrators?: () => Promise<unknown[]>;
}

export async function userIsAdmin(ctx: AdminCheckContextLike): Promise<boolean> {
	const userId = ctx.from?.id;
	if (!userId) return false;
	const chat = ctx.chat;
	if (!chat) return false;

	// Bot owner (BOT_ADMIN_IDS) is always admin everywhere
	if (CONFIG.botAdminIds.length > 0 && CONFIG.botAdminIds.includes(String(userId))) {
		return true;
	}

	// DMs: if locked, only bot owners (checked above) can use admin commands
	// If unlocked, any DM user is treated as admin (original behavior)
	if (chat.type === "private") return !CONFIG.lockDmConfig;

	// Groups/supergroups: Telegram chat admins can manage their own chat's config
	if (ctx.getChatAdministrators) {
		try {
			const admins = await ctx.getChatAdministrators();
			for (const m of admins) {
				const candidate = m as { user?: { id?: number } };
				if (candidate.user?.id === userId) return true;
			}
			return false;
		} catch (_err) {
			return false;
		}
	}
	return false;
}

export function assertAdmin(isAdmin: boolean): asserts isAdmin {
	if (!isAdmin) throw new Error("admin_required");
}

export async function requireAdmin(ctx: AdminCheckContextLike): Promise<boolean> {
	return await userIsAdmin(ctx);
}
