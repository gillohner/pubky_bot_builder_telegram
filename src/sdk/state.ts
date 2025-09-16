// sdk/state.ts
// State directive types & helper methods.

export interface StateDirectiveClear {
	op: "clear";
}
export interface StateDirectiveReplace {
	op: "replace";
	value: Record<string, unknown>;
}
export interface StateDirectiveMerge {
	op: "merge";
	value: Record<string, unknown>;
}
export type StateDirective = StateDirectiveClear | StateDirectiveReplace | StateDirectiveMerge;

export const state = {
	replace(value: Record<string, unknown>): StateDirectiveReplace {
		return { op: "replace", value };
	},
	merge(value: Record<string, unknown>): StateDirectiveMerge {
		return { op: "merge", value };
	},
	clear(): StateDirectiveClear {
		return { op: "clear" };
	},
} as const;
