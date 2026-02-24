// packages/core_services/event-creator/flows/location.ts
// Location selection flow with Nominatim geocoding, confirmation, and message cleanup

import {
	type CallbackEvent,
	type MessageEvent,
	state,
	UIBuilder,
	uiKeyboard,
} from "@sdk/mod.ts";
import { LOC_REPLACE_GROUP, SERVICE_ID } from "../constants.ts";
import type { EventCreatorState } from "../types.ts";
import { showOptionalMenu } from "./optional_menu.ts";
import { validateLocationName } from "../utils/validation.ts";

interface NominatimResult {
	place_id: number;
	osm_type: string;
	osm_id: number;
	display_name: string;
	lat: string;
	lon: string;
	type: string;
}

/**
 * Show the location type selection menu (Physical vs Online)
 */
export function showLocationTypeMenu(st: EventCreatorState) {
	const keyboard = UIBuilder.keyboard()
		.namespace(SERVICE_ID)
		.callback("📍 Physical Location", "location:type:physical")
		.row()
		.callback("💻 Online Meeting", "location:type:online")
		.row()
		.callback("← Back to Menu", "location:back");

	return uiKeyboard(keyboard.build(), "📍 *Add Location*\n\nWhat type of location?", {
		state: state.replace(st),
		options: { replaceGroup: LOC_REPLACE_GROUP },
	});
}

/**
 * Handle location type selection callback
 */
export function handleLocationTypeSelect(ev: CallbackEvent, locationType: string) {
	const st = (ev.state ?? {}) as EventCreatorState;

	if (locationType === "physical") {
		const keyboard = UIBuilder.keyboard()
			.namespace(SERVICE_ID)
			.callback("← Cancel", "location:back");

		return uiKeyboard(
			keyboard.build(),
			"📍 *Physical Location*\n\n" +
				'Enter the venue name or address to search (or type "skip" to cancel):',
			{
				state: state.replace({
					...st,
					waitingFor: "location_search",
				}),
				options: { replaceGroup: LOC_REPLACE_GROUP },
			},
		);
	}

	if (locationType === "online") {
		const keyboard = UIBuilder.keyboard()
			.namespace(SERVICE_ID)
			.callback("← Cancel", "location:back");

		return uiKeyboard(
			keyboard.build(),
			"💻 *Online Meeting*\n\n" +
				'Enter the meeting URL (e.g., https://meet.google.com/... or https://zoom.us/...)\n\n' +
				'Or type "skip" to cancel:',
			{
				state: state.replace({
					...st,
					waitingFor: "location_online_url",
				}),
				options: { replaceGroup: LOC_REPLACE_GROUP },
			},
		);
	}

	return showLocationTypeMenu(st);
}

/**
 * Show confirmation after location selection
 */
function showLocationConfirmation(st: EventCreatorState) {
	const loc = st.location!;
	const isOnline = loc.location_type === "ONLINE";
	const retryAction = isOnline ? "location:type:online" : "location:type:physical";

	const keyboard = UIBuilder.keyboard()
		.namespace(SERVICE_ID)
		.callback("✅ Confirm", "location:confirm")
		.row()
		.callback("🔍 Search Again", retryAction)
		.row()
		.callback("← Back to Menu", "location:back");

	let text: string;
	if (isOnline) {
		text = `💻 *Online Meeting Selected*\n\n*URL:* ${loc.structured_data}`;
	} else {
		text = `📍 *Location Selected*\n\n*Name:* ${loc.name}`;
		if (loc.structured_data) text += `\n🔗 [OpenStreetMap](${loc.structured_data})`;
		if (loc.lat != null && loc.lng != null) {
			text += `\n📍 ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
		}
	}
	text += "\n\nConfirm this location?";

	return uiKeyboard(keyboard.build(), text, {
		state: state.replace(st),
		options: { replaceGroup: LOC_REPLACE_GROUP },
	});
}

/**
 * Handle Nominatim search results callback (user selecting a result)
 */
export function handleLocationSelect(ev: CallbackEvent, index: string) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const results = (st as Record<string, unknown>)._nominatimResults as NominatimResult[] | undefined;

	const idx = parseInt(index, 10);
	if (!results || isNaN(idx) || idx < 0 || idx >= results.length) {
		const keyboard = UIBuilder.keyboard()
			.namespace(SERVICE_ID)
			.callback("🔍 Search Again", "location:type:physical")
			.row()
			.callback("← Back to Menu", "location:back");

		return uiKeyboard(keyboard.build(), "Invalid selection. Please try again.", {
			state: state.replace(st),
			options: { replaceGroup: LOC_REPLACE_GROUP },
		});
	}

	const selected = results[idx];
	const osmUrl = `https://www.openstreetmap.org/${selected.osm_type}/${selected.osm_id}`;

	const updatedState = { ...st };
	updatedState.location = {
		name: selected.display_name,
		location_type: "PHYSICAL",
		structured_data: osmUrl,
		lat: parseFloat(selected.lat),
		lng: parseFloat(selected.lon),
	};
	delete (updatedState as Record<string, unknown>).waitingFor;

	return showLocationConfirmation(updatedState);
}

/**
 * Handle location search text input (query Nominatim)
 */
export async function handleLocationSearchInput(
	text: string,
	st: EventCreatorState,
	_ev: MessageEvent,
) {
	const validation = validateLocationName(text);
	if (!validation.valid) {
		const keyboard = UIBuilder.keyboard()
			.namespace(SERVICE_ID)
			.callback("← Cancel", "location:back");

		return uiKeyboard(keyboard.build(), validation.error!, {
			state: state.replace(st),
			options: { replaceGroup: LOC_REPLACE_GROUP },
		});
	}

	// Query Nominatim
	try {
		const url = new URL("https://nominatim.openstreetmap.org/search");
		url.searchParams.set("q", text);
		url.searchParams.set("format", "json");
		url.searchParams.set("addressdetails", "1");
		url.searchParams.set("limit", "5");

		const response = await fetch(url.toString(), {
			headers: {
				"User-Agent": "PubkyBotBuilder/1.0",
			},
		});

		if (!response.ok) {
			throw new Error(`Nominatim returned ${response.status}`);
		}

		const results = (await response.json()) as NominatimResult[];

		if (results.length === 0) {
			// No results — offer to use as plain name or retry
			const keyboard = UIBuilder.keyboard()
				.namespace(SERVICE_ID)
				.callback(`📝 Use "${text.substring(0, 30)}" as name`, "location:use_name")
				.row()
				.callback("🔍 Search again", "location:type:physical")
				.row()
				.callback("← Back to Menu", "location:back");

			const updatedState = {
				...st,
				_pendingLocationName: text,
			};
			delete (updatedState as Record<string, unknown>).waitingFor;

			return uiKeyboard(
				keyboard.build(),
				`📍 No results found for "${text}".\n\nYou can use it as a plain location name or search again.`,
				{
					state: state.replace(updatedState),
					options: { replaceGroup: LOC_REPLACE_GROUP },
					deleteTrigger: true,
				},
			);
		}

		// Show results as keyboard buttons
		const keyboard = UIBuilder.keyboard().namespace(SERVICE_ID);
		for (let i = 0; i < results.length; i++) {
			const r = results[i];
			// Truncate display name for button
			const label = r.display_name.length > 60
				? r.display_name.substring(0, 57) + "..."
				: r.display_name;
			keyboard.callback(`📍 ${label}`, `location:select:${i}`).row();
		}
		keyboard
			.callback(`📝 Use "${text.substring(0, 30)}" as name`, "location:use_name")
			.row()
			.callback("← Back to Menu", "location:back");

		// Store results in state for selection
		const updatedState = {
			...st,
			_nominatimResults: results,
			_pendingLocationName: text,
		};
		delete (updatedState as Record<string, unknown>).waitingFor;

		return uiKeyboard(
			keyboard.build(),
			`📍 *Search Results* for "${text}"\n\nSelect a location:`,
			{
				state: state.replace(updatedState),
				options: { replaceGroup: LOC_REPLACE_GROUP },
				deleteTrigger: true,
			},
		);
	} catch (_err) {
		// Nominatim failed — fall back to using the text as plain name
		const updatedState = { ...st };
		updatedState.location = {
			name: text,
			location_type: "PHYSICAL",
		};
		delete (updatedState as Record<string, unknown>).waitingFor;
		delete (updatedState as Record<string, unknown>)._nominatimResults;
		delete (updatedState as Record<string, unknown>)._pendingLocationName;

		return showOptionalMenu(updatedState, _ev, { cleanupGroup: LOC_REPLACE_GROUP });
	}
}

/**
 * Handle "use as plain name" button
 */
export function handleUseAsName(ev: CallbackEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;
	const name = (st as Record<string, unknown>)._pendingLocationName as string | undefined;

	if (!name) {
		return showLocationTypeMenu(st);
	}

	const updatedState = { ...st };
	updatedState.location = {
		name,
		location_type: "PHYSICAL",
	};
	delete (updatedState as Record<string, unknown>).waitingFor;

	return showLocationConfirmation(updatedState);
}

/**
 * Handle location confirmation — accept and return to optional menu
 */
export function handleLocationConfirm(ev: CallbackEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;

	// Clean temp fields
	const cleaned = { ...st };
	delete (cleaned as Record<string, unknown>)._nominatimResults;
	delete (cleaned as Record<string, unknown>)._pendingLocationName;
	delete (cleaned as Record<string, unknown>).waitingFor;

	return showOptionalMenu(cleaned, ev, { cleanupGroup: LOC_REPLACE_GROUP });
}

/**
 * Handle location back — clean up and return to optional menu
 */
export function handleLocationBack(ev: CallbackEvent) {
	const st = (ev.state ?? {}) as EventCreatorState;

	// Clean temp fields
	const cleaned = { ...st };
	delete (cleaned as Record<string, unknown>)._nominatimResults;
	delete (cleaned as Record<string, unknown>)._pendingLocationName;
	delete (cleaned as Record<string, unknown>).waitingFor;

	return showOptionalMenu(cleaned, ev, { cleanupGroup: LOC_REPLACE_GROUP });
}

/**
 * Handle online meeting URL input
 */
export function handleOnlineUrlInput(
	text: string,
	st: EventCreatorState,
	_ev: MessageEvent,
) {
	// Basic URL validation
	try {
		const url = new URL(text);
		if (!url.protocol.startsWith("http")) {
			const keyboard = UIBuilder.keyboard()
				.namespace(SERVICE_ID)
				.callback("← Cancel", "location:back");

			return uiKeyboard(
				keyboard.build(),
				"Please enter a valid URL starting with http:// or https://",
				{
					state: state.replace(st),
					options: { replaceGroup: LOC_REPLACE_GROUP },
				},
			);
		}
	} catch {
		const keyboard = UIBuilder.keyboard()
			.namespace(SERVICE_ID)
			.callback("← Cancel", "location:back");

		return uiKeyboard(
			keyboard.build(),
			"That doesn't look like a valid URL. Please enter a meeting link:",
			{
				state: state.replace(st),
				options: { replaceGroup: LOC_REPLACE_GROUP },
			},
		);
	}

	const updatedState = { ...st };
	updatedState.location = {
		name: "Online Meeting",
		location_type: "ONLINE",
		structured_data: text,
	};
	delete (updatedState as Record<string, unknown>).waitingFor;

	return showLocationConfirmation(updatedState);
}
