// Survey flow (clean version): always deletes user inputs and the /survey command.
// Stages: 1=color (inline keyboard), 2=animal text, 3=image (photo or URL), final=photo summary.

interface TelegramMessagePhotoSize {
	file_id: string;
}

function buildColorKeyboard(selected?: string) {
	const colors = ["Red", "Green", "Blue", "Yellow"];
	return {
		reply_markup: {
			inline_keyboard: colors.map((c) => [
				{
					text: selected === c ? `✅ ${c}` : c,
					callback_data: `svc:mock_survey|color:${c}`,
				},
			]),
		},
	};
}

type SurveyState = { stage: number; color?: string; animal?: string };
type BaseResp =
	| {
		kind: "reply";
		text: string;
		state?: unknown;
		options?: Record<string, unknown>;
		deleteTrigger?: boolean;
	}
	| {
		kind: "photo";
		photo: string;
		caption?: string;
		state?: unknown;
		deleteTrigger?: boolean;
	}
	| { kind: "none" };

async function run() {
	const rawChunks: Uint8Array[] = [];
	for await (
		const c of (
			Deno.stdin as unknown as { readable: ReadableStream<Uint8Array> }
		).readable
	) {
		rawChunks.push(c);
	}
	const total = rawChunks.reduce((n, c) => n + c.length, 0);
	const buf = new Uint8Array(total);
	let o = 0;
	for (const c of rawChunks) {
		buf.set(c, o);
		o += c.length;
	}
	const payloadText = new TextDecoder().decode(buf).trim();
	const payload = payloadText ? JSON.parse(payloadText) : { event: null };
	const ev = payload.event || { type: "unknown" };
	const st: SurveyState = (ev.state as SurveyState) || { stage: 0 };
	const stage = st.stage || 0;

	let resp: BaseResp = { kind: "none" };

	// COMMAND start
	if (ev.type === "command" && stage === 0) {
		resp = {
			kind: "reply",
			text: "Survey started. Pick a color:",
			state: { op: "replace", value: { stage: 1 } },
			options: buildColorKeyboard(),
			deleteTrigger: true,
		};
	} else if (ev.type === "callback") {
		const data: string = ev.data || "";
		if (data.startsWith("svc:mock_survey|color:")) {
			const color = data.split("color:")[1];
			resp = {
				kind: "reply",
				text: `Color chosen: ${color}. Now type your favorite animal (min 3 chars).`,
				state: { op: "replace", value: { stage: 2, color } },
				deleteTrigger: true,
			};
		}
	} else if (ev.type === "message") {
		if (stage === 1) {
			// User typed instead of using keyboard
			resp = {
				kind: "reply",
				text: "Please pick a color using the buttons below.",
				state: { op: "merge", value: { stage: 1 } },
				options: buildColorKeyboard(),
				deleteTrigger: true,
			};
		} else if (stage === 2) {
			const animal = (ev.message?.text || "").trim();
			if (animal.length < 3) {
				resp = {
					kind: "reply",
					text: "Animal too short (>=3 chars). Try again:",
					state: { op: "merge", value: { stage: 2, color: st.color } },
					deleteTrigger: true,
				};
			} else {
				resp = {
					kind: "reply",
					text: "Great. Send a photo of that animal OR an image URL (http/https).",
					state: {
						op: "replace",
						value: { stage: 3, color: st.color, animal },
					},
					deleteTrigger: true,
				};
			}
		} else if (stage === 3) {
			// Accept photo or URL
			const msg = ev.message as {
				photo?: TelegramMessagePhotoSize[];
				text?: string;
			};
			let photoRef: string | undefined;
			if (Array.isArray(msg.photo) && msg.photo.length) {
				photoRef = msg.photo[msg.photo.length - 1]!.file_id;
			} else if (msg.text && /^https?:\/\//i.test(msg.text.trim())) {
				photoRef = msg.text.trim();
			}
			if (!photoRef) {
				resp = {
					kind: "reply",
					text: "Invalid image. Send a Telegram photo or a valid http/https URL.",
					state: {
						op: "merge",
						value: { stage: 3, color: st.color, animal: st.animal },
					},
					deleteTrigger: true,
				};
			} else {
				resp = {
					kind: "photo",
					photo: photoRef,
					caption: `Survey complete. Color=${st.color ?? ""} Animal=${st.animal ?? ""}`,
					state: { op: "clear" },
					deleteTrigger: true,
				};
			}
		}
	}

	console.log(JSON.stringify(resp));
}

await run();
