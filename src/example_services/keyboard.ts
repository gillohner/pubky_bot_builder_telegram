// example_services/keyboard.ts
// Simple inline keyboard demo: /keyboard shows buttons; callbacks edit the message.
// Callback data format: svc:mock_keyboard|btn:<id>

interface ButtonDef {
	id: string;
	label: string;
	emoji?: string;
}
const BUTTONS: ButtonDef[] = [
	{ id: "one", label: "First", emoji: "1️⃣" },
	{ id: "two", label: "Second", emoji: "2️⃣" },
];

function makeKeyboard() {
	return {
		inline_keyboard: [
			BUTTONS.map((b) => ({
				text: `${b.emoji ?? ""} ${b.label}`.trim(),
				callback_data: `svc:mock_keyboard|btn:${b.id}`,
			})),
		],
	};
}

function renderSelection(id: string) {
	const btn = BUTTONS.find((b) => b.id === id);
	if (!btn) return "Unknown selection";
	return `You picked: ${btn.label}`;
}

async function readAll() {
	const d = new TextDecoder();
	const cs: Uint8Array[] = [];
	const stdin = (
		Deno.stdin as unknown as { readable: ReadableStream<Uint8Array> }
	).readable;
	for await (const c of stdin) cs.push(c);
	const t = new Uint8Array(cs.reduce((n, c) => n + c.length, 0));
	let o = 0;
	for (const c of cs) {
		t.set(c, o);
		o += c.length;
	}
	return d.decode(t).trim();
}
const raw = await readAll();
const payload = raw ? JSON.parse(raw) : { event: null, ctx: null };
type ServiceEvent =
	| { type: "command" }
	| { type: "callback"; data?: string }
	| { type: string };
const ev: ServiceEvent = (payload.event as ServiceEvent) || { type: "unknown" };
let body: Record<string, unknown> = { kind: "none" };
if (ev.type === "command") {
	body = {
		kind: "reply",
		text: "Tap a button:",
		options: { reply_markup: makeKeyboard() },
	};
} else if (ev.type === "callback") {
	const data = "data" in ev && typeof ev.data === "string" ? ev.data : "";
	const m = /\|btn:([^|]+)/.exec(data);
	const id = m ? m[1] : "";
	body = {
		kind: "edit",
		text: renderSelection(id),
		options: { reply_markup: makeKeyboard() },
	};
}
console.log(JSON.stringify(body));
