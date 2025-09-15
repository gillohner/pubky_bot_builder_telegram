export const FLOW_SERVICE_ID = "mock_flow" as const;
export const FLOW_VERSION = "1.0.0" as const;
export const FLOW_COMMAND = "flow" as const;

export interface FlowState {
	step?: number;
	first?: string;
}
