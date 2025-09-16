// /packages/demo_services/survey/service.ts
import { defineService, inlineKeyboard, none, photo, reply, runService, state } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	SURVEY_COLORS,
	SURVEY_COMMAND,
	SURVEY_SERVICE_ID,
	SURVEY_VERSION,
	SurveyState,
} from "./constants.ts";

interface TelegramMessagePhotoSize {
	file_id: string;
}

function asSurveyState(v: unknown): SurveyState | undefined {
	if (
		v && typeof v === "object" && "stage" in v &&
		typeof (v as { stage?: unknown }).stage === "number"
	) {
		const o = v as Record<string, unknown>;
		return {
			stage: o.stage as number,
			color: o.color as string | undefined,
			animal: o.animal as string | undefined,
		};
	}
	return undefined;
}

function colorKeyboard(selected?: string) {
	const keyboard = inlineKeyboard();

	for (const color of SURVEY_COLORS) {
		const text = selected === color ? `✅ ${color}` : color;
		keyboard.button({ text, data: `svc:mock_survey|color:${color}` });
		keyboard.row();
	}

	return keyboard.build();
}

const service = defineService({
	id: SURVEY_SERVICE_ID,
	version: SURVEY_VERSION,
	kind: "command_flow",
	command: SURVEY_COMMAND,
	description: "Three-step survey collecting color, animal, image",
	handlers: {
		command: (ev: CommandEvent) => {
			const st = asSurveyState(ev.state) ?? { stage: 0 };
			if (st.stage === 0) {
				return reply("Survey started. Pick a color:", {
					options: { reply_markup: colorKeyboard() },
					state: state.replace({ stage: 1 }),
					deleteTrigger: true,
				});
			}
			return reply("Survey already active.");
		},
		callback: (ev: CallbackEvent) => {
			const data = ev.data;
			if (data.startsWith("color:")) {
				const color = data.split("color:")[1];
				return reply(`Color chosen: ${color}. Now type your favorite animal (min 3 chars).`, {
					state: state.replace({ stage: 2, color }),
					deleteTrigger: true,
				});
			}
			return none();
		},
		message: (ev: MessageEvent) => {
			const st = asSurveyState(ev.state) ?? { stage: 0 };
			if (st.stage === 1) {
				return reply("Pick a color using the buttons below.", {
					state: state.merge({ stage: 1 }),
					options: { reply_markup: colorKeyboard(st.color) },
					deleteTrigger: true,
				});
			}
			if (st.stage === 2) {
				const animal = ((ev.message as { text?: string })?.text || "").trim();
				if (animal.length < 3) {
					return reply("Animal too short (>=3 chars). Try again:", {
						state: state.merge({ stage: 2, color: st.color }),
						deleteTrigger: true,
					});
				}
				return reply("Great. Send a photo of that animal OR an image URL (http/https).", {
					state: state.replace({ stage: 3, color: st.color, animal }),
					deleteTrigger: true,
				});
			}
			if (st.stage === 3) {
				const msg = ev.message as { photo?: TelegramMessagePhotoSize[]; text?: string };
				let photoRef: string | undefined;
				if (Array.isArray(msg.photo) && msg.photo.length) {
					photoRef = msg.photo[msg.photo.length - 1]!.file_id;
				} else if (msg.text && /^https?:\/\//i.test(msg.text.trim())) photoRef = msg.text.trim();
				if (!photoRef) {
					return reply("Invalid image. Send a Telegram photo or a valid http/https URL.", {
						state: state.merge({ stage: 3, color: st.color, animal: st.animal }),
						deleteTrigger: true,
					});
				}
				return photo(photoRef, {
					caption: `Survey complete. Color=${st.color ?? ""} Animal=${st.animal ?? ""}`,
					state: state.clear(),
					deleteTrigger: true,
				});
			}
			return none();
		},
	},
});

export default service;
if (import.meta.main) await runService(service);
