// /packages/demo_services/ui_demo/constants.ts
export const UI_DEMO_SERVICE_ID = "ui_demo" as const;
export const UI_DEMO_VERSION = "1.0.0" as const;
export const UI_DEMO_COMMAND = "ui" as const;

export const UI_DEMO_MESSAGES = {
	en: {
		welcome: "Welcome to UI Demo! Choose what to try:",
		keyboard: "Here's a cross-platform keyboard:",
		menu: "Here's a menu with options:",
		card: "Here's a card:",
		carousel: "Here's a carousel:",
		form: "Here's a form:",
		tryAgain: "Try again?",
		buttonPressed: "You pressed: {{button}}",
		selectOption: "Please select an option",
		thanks: "Thank you for trying the UI demo!",
		formSubmitted: "✅ Form submitted successfully!",
	},
};
