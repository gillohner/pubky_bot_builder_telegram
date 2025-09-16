// src/middleware/admin.ts
// Utilities to determine whether a user is an administrator for a chat.
// Provides a pure fallback for private chats (treat chat owner as admin) and
// uses grammY context when available for group/supergroup chats.

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
	// Private chats: treat the user themselves as admin (allows setup/testing)
	if (chat.type === "private") return true;
	// For groups/supergroups: query administrators if available
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
