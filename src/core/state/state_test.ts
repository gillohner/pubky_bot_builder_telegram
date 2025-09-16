// src/core/state/state_test.ts
// Tests for state directive application, flow TTL expiration, and sweep logic.
import {
	applyStateDirective,
	clearActiveFlow,
	getActiveFlow,
	getServiceState,
	setActiveFlow,
	setServiceState,
	sweepExpiredFlows,
} from "@core/state/state.ts";

Deno.test("applyStateDirective replace and merge increments version", () => {
	setServiceState({ chatId: "c", userId: "u", serviceId: "s" }, { a: 1 });
	const before = getServiceState({ chatId: "c", userId: "u", serviceId: "s" });
	if (!before) throw new Error("expected initial state");
	const afterReplace = applyStateDirective({
		directive: { op: "replace", value: { b: 2 } },
		chatId: "c",
		userId: "u",
		serviceId: "s",
	});
	if (!afterReplace || afterReplace.value.b !== 2) throw new Error("replace failed");
	const afterMerge = applyStateDirective({
		directive: { op: "merge", value: { c: 3 } },
		chatId: "c",
		userId: "u",
		serviceId: "s",
	});
	if (!afterMerge || afterMerge.value.c !== 3 || afterMerge.value.b !== 2) {
		throw new Error("merge failed");
	}
});

Deno.test("applyStateDirective clear removes state", () => {
	setServiceState({ chatId: "c2", userId: "u2", serviceId: "s2" }, { x: true });
	applyStateDirective({
		directive: { op: "clear" },
		chatId: "c2",
		userId: "u2",
		serviceId: "s2",
	});
	const st = getServiceState({ chatId: "c2", userId: "u2", serviceId: "s2" });
	if (st) throw new Error("state should be cleared");
});

Deno.test("active flow TTL expires and sweep cleans up", () => {
	setActiveFlow("chatT", "userT", "svcT", { ttlMs: 10 });
	const active = getActiveFlow("chatT", "userT");
	if (!active) throw new Error("expected active flow");
	// Simulate time passing by mutating since (test-only direct cast)
	(active as { since: number }).since = Date.now() - 20;
	const expired = getActiveFlow("chatT", "userT");
	if (expired) throw new Error("expected expired flow to be cleared");
	// Create two flows and expire one
	setActiveFlow("chatA", "userA", "svcA", { ttlMs: 5 });
	setActiveFlow("chatB", "userB", "svcB", { ttlMs: 1000 });
	const actA = getActiveFlow("chatA", "userA");
	if (!actA) throw new Error("expected actA");
	// expire A
	(actA as { since: number }).since = Date.now() - 10;
	const removed = sweepExpiredFlows();
	if (removed < 1) throw new Error("expected at least one removal");
	if (getActiveFlow("chatA", "userA")) throw new Error("chatA flow should be gone");
	if (!getActiveFlow("chatB", "userB")) throw new Error("chatB flow should persist");
	clearActiveFlow("chatB", "userB");
});
