export const SURVEY_SERVICE_ID = "survey" as const;
export const SURVEY_VERSION = "1.0.0" as const;
export const SURVEY_COMMAND = "survey" as const;

export interface SurveyState {
	stage: number;
	color?: string;
	animal?: string;
}

export const SURVEY_COLORS = ["Red", "Green", "Blue", "Yellow"] as const;
export type SurveyColor = typeof SURVEY_COLORS[number];
