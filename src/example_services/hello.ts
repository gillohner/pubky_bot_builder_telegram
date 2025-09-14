// example_services/hello.ts
// Simple hello command service (standalone sandbox script)

interface CommandEvent {
	type: "command";
}
interface MessageEvent {
	type: "message";
	message?: { text?: string };
}
interface CallbackEvent {
	type: "callback";
	data?: string;
}
type ServiceEvent =
	| CommandEvent
	| MessageEvent
	| CallbackEvent
	| { type: string };
interface Payload {
	event?: ServiceEvent | null;
	ctx?: Record<string, unknown> | null;
}

function handle(payload: Payload) {
	const ev = payload.event;
	if (ev && ev.type === "command") {
		return { kind: "reply", text: "Hello from sandbox!" };
	}
	return { kind: "none" } as const;
}

async function readAll(): Promise<string> {
	const dec = new TextDecoder();
	const chunks: Uint8Array[] = [];
	const stdin = (
		Deno.stdin as unknown as { readable: ReadableStream<Uint8Array> }
	).readable;
	for await (const c of stdin) chunks.push(c);
	const total = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
	let o = 0;
	for (const c of chunks) {
		total.set(c, o);
		o += c.length;
	}
	return dec.decode(total).trim();
}

const raw = await readAll();
const payload = raw ? JSON.parse(raw) : { event: null, ctx: null };
const result = await handle(payload);
console.log(JSON.stringify(result));
