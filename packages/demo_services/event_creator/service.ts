// packages/demo_services/event_creator/service.ts
// Event creator service for Eventky - creates events on Pubky with admin approval

import { defineService, error, pubkyWrite, reply, runService, state } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	DATE_REGEX,
	DEFAULT_COMMAND,
	MAX_DESCRIPTION_LENGTH,
	MAX_TITLE_LENGTH,
	SERVICE_ID,
	SERVICE_KIND,
	SERVICE_VERSION,
	STEP_CONFIRM,
	STEP_DATE,
	STEP_DESCRIPTION,
	STEP_LOCATION,
	STEP_TIME,
	STEP_TITLE,
	TIME_REGEX,
} from "./constants.ts";

// Import eventky-specs for validation and types (local implementation)
import { createEvent, type Location, type PubkyAppEvent, validateTimezone } from "@eventky/mod.ts";

// State interface for the event creation flow
interface EventState {
	step?: number;
	title?: string;
	description?: string;
	date?: string; // YYYY-MM-DD
	time?: string; // HH:MM
	location?: {
		name?: string;
		address?: string;
		lat?: number;
		lng?: number;
	};
}

// Service config interface
interface EventCreatorConfig {
	calendarUri?: string; // pubky:// URI to the calendar this event belongs to
	defaultTimezone?: string; // e.g., "Europe/Vienna"
	requireLocation?: boolean;
}

// Format date and time into ISO datetime string
function formatDateTime(date: string, time: string): string {
	return `${date}T${time}:00`;
}

const service = defineService({
	id: SERVICE_ID,
	version: SERVICE_VERSION,
	kind: SERVICE_KIND,

	handlers: {
		command: (ev: CommandEvent) => {
			const config = ev.serviceConfig as EventCreatorConfig | undefined;
			const calendarInfo = config?.calendarUri
				? `\n📅 Calendar: ${config.calendarUri.split("/").pop()}`
				: "";

			return reply(
				`🎉 **Create a New Event**${calendarInfo}\n\n` +
					"Let's create an event step by step.\n\n" +
					`📝 **Step 1/${config?.requireLocation ? "5" : "4"}**: What's the event title?`,
				{
					state: state.replace({ step: STEP_TITLE }),
				},
			);
		},

		message: (ev: MessageEvent) => {
			const st = (ev.state ?? {}) as EventState;
			const text = (ev.message as { text?: string })?.text?.trim() ?? "";
			const config = ev.serviceConfig as EventCreatorConfig | undefined;
			const totalSteps = config?.requireLocation ? 5 : 4;

			// Handle each step
			switch (st.step) {
				case STEP_TITLE: {
					if (!text) {
						return reply("Please enter a title for your event.");
					}
					if (text.length > MAX_TITLE_LENGTH) {
						return reply(`Title is too long. Maximum ${MAX_TITLE_LENGTH} characters.`);
					}
					return reply(
						`✅ Title: **${text}**\n\n` +
							`📝 **Step 2/${totalSteps}**: Describe the event (or send "skip" to skip):`,
						{
							state: state.merge({ step: STEP_DESCRIPTION, title: text }),
						},
					);
				}

				case STEP_DESCRIPTION: {
					const description = text.toLowerCase() === "skip" ? undefined : text;
					if (description && description.length > MAX_DESCRIPTION_LENGTH) {
						return reply(`Description is too long. Maximum ${MAX_DESCRIPTION_LENGTH} characters.`);
					}
					return reply(
						(description ? `✅ Description saved.\n\n` : `⏭️ Description skipped.\n\n`) +
							`📝 **Step 3/${totalSteps}**: When is the event? (YYYY-MM-DD)`,
						{
							state: state.merge({ step: STEP_DATE, description }),
						},
					);
				}

				case STEP_DATE: {
					if (!DATE_REGEX.test(text)) {
						return reply(
							"Invalid date format. Please use YYYY-MM-DD\n\nExample: 2026-02-15",
						);
					}
					// Validate the date is in the future
					const eventDate = new Date(text);
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					if (eventDate < today) {
						return reply("The event date must be in the future.");
					}
					return reply(
						`✅ Date: **${text}**\n\n` +
							`📝 **Step 4/${totalSteps}**: What time? (HH:MM in 24h format)`,
						{
							state: state.merge({ step: STEP_TIME, date: text }),
						},
					);
				}

				case STEP_TIME: {
					if (!TIME_REGEX.test(text)) {
						return reply(
							"Invalid time format. Please use HH:MM (24-hour)\n\nExample: 19:30",
						);
					}
					const [hours, minutes] = text.split(":").map(Number);
					if (hours! > 23 || minutes! > 59) {
						return reply("Invalid time. Hours must be 0-23, minutes 0-59.");
					}

					if (config?.requireLocation) {
						return reply(
							`✅ Time: **${text}**\n\n` +
								`📝 **Step 5/${totalSteps}**: Where is the event?\n` +
								"Send a location name/address, or send your location.",
							{
								state: state.merge({ step: STEP_LOCATION, time: text }),
							},
						);
					}

					// Skip to confirmation
					return buildConfirmation(st, text, undefined, config);
				}

				case STEP_LOCATION: {
					// Handle text location
					const location = { name: text };
					return buildConfirmation(st, undefined, location, config);
				}

				default:
					return reply("Something went wrong. Please start over with /" + DEFAULT_COMMAND);
			}
		},

		callback: (ev: CallbackEvent) => {
			const st = (ev.state ?? {}) as EventState;
			const data = ev.data ?? "";
			const config = ev.serviceConfig as EventCreatorConfig | undefined;

			if (data === "confirm") {
				// Validate timezone if provided
				if (config?.defaultTimezone && !validateTimezone(config.defaultTimezone)) {
					return error(`Invalid timezone: ${config.defaultTimezone}`);
				}

				// Format the datetime
				const dtstart = formatDateTime(st.date!, st.time!);

				// Build locations array if location provided
				const locations: Location[] | undefined = st.location?.name
					? [
						{
							name: st.location.name,
							location_type: "PHYSICAL" as const,
							description: st.location.address,
							geo: st.location.lat && st.location.lng
								? `${st.location.lat};${st.location.lng}`
								: undefined,
						},
					]
					: undefined;

				// Create the event using local eventky-specs
				const result = createEvent({
					summary: st.title!,
					dtstart,
					description: st.description,
					dtstart_tzid: config?.defaultTimezone,
					x_pubky_calendar_uris: config?.calendarUri ? [config.calendarUri] : undefined,
					locations,
				});

				// Get the event and metadata from the result
				const event = result.event;
				const meta = result.meta;

				// Build preview for admin approval
				const preview = buildEventPreview(event, st);

				// Submit for Pubky write with admin approval using the path from meta
				return pubkyWrite(meta.path, event, {
					preview,
					onApprovalMessage: `✅ Your event "${st.title}" has been published to Pubky!`,
					state: state.clear(),
				});
			}

			if (data === "cancel") {
				return reply("❌ Event creation cancelled.", {
					state: state.clear(),
					deleteTrigger: true,
				});
			}

			if (data === "edit") {
				return reply(
					"📝 Let's start over.\n\n" + "What's the event title?",
					{
						state: state.replace({ step: STEP_TITLE }),
					},
				);
			}

			return reply("Unknown action. Please start over with /" + DEFAULT_COMMAND, {
				state: state.clear(),
			});
		},
	},
});

// Helper to build confirmation message
function buildConfirmation(
	st: EventState,
	time?: string,
	location?: { name?: string; address?: string; lat?: number; lng?: number },
	config?: EventCreatorConfig,
) {
	const finalTime = time ?? st.time;
	const finalLocation = location ?? st.location;

	const summary = [
		`📋 **Event Summary**\n`,
		`📌 **Title:** ${st.title}`,
		st.description ? `📝 **Description:** ${st.description}` : null,
		`📅 **Date:** ${st.date}`,
		`⏰ **Time:** ${finalTime}`,
		finalLocation?.name ? `📍 **Location:** ${finalLocation.name}` : null,
		config?.calendarUri ? `📅 **Calendar:** ${config.calendarUri.split("/").pop()}` : null,
		`\n✅ Ready to submit for publishing?`,
	]
		.filter(Boolean)
		.join("\n");

	return reply(summary, {
		state: state.merge({
			step: STEP_CONFIRM,
			time: finalTime,
			location: finalLocation,
		}),
		options: {
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "✅ Submit", callback_data: `svc:${DEFAULT_COMMAND}|confirm` },
						{ text: "✏️ Edit", callback_data: `svc:${DEFAULT_COMMAND}|edit` },
						{ text: "❌ Cancel", callback_data: `svc:${DEFAULT_COMMAND}|cancel` },
					],
				],
			},
		},
	});
}

// Helper to build preview for admin approval
function buildEventPreview(event: PubkyAppEvent, st: EventState): string {
	const lines = [
		`📅 **${event.summary}**`,
		event.description ? `\n${event.description}` : null,
		`\n📆 ${st.date} at ${st.time}`,
		event.dtstart_tzid ? `🌍 ${event.dtstart_tzid}` : null,
		event.locations?.[0]?.name ? `📍 ${event.locations[0].name}` : null,
		event.x_pubky_calendar_uris?.[0] ? `\n🔗 Calendar: ${event.x_pubky_calendar_uris[0]}` : null,
	];
	return lines.filter(Boolean).join("\n");
}

export default service;

// Allow running as standalone service
if (import.meta.main) await runService(service);
