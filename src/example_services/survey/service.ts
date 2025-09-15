// example_services/survey/service.ts
import { defineService, none, photoResp, reply, runService, state } from "../../pbb_sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "../../pbb_sdk/mod.ts";

interface TelegramMessagePhotoSize {
	file_id: string;
}
interface SurveyState {
	stage: number;
	color?: string;
	animal?: string;
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
	const colors = ["Red", "Green", "Blue", "Yellow"];
	return {
		inline_keyboard: colors.map((
			c,
		) => [{ text: selected === c ? `✅ ${c}` : c, callback_data: `svc:mock_survey|color:${c}` }]),
	};
}

const service = defineService({
	id: "mock_survey",
	version: "1.0.0",
	kind: "command_flow",
	command: "survey",
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
			if (data.startsWith("svc:mock_survey|color:")) {
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
				return photoResp(photoRef, {
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
