// example_services/listener.ts
// Simple listener that replies to any message

type ServiceEvent = { type: "message" } | { type: string };
function exec(payload: { event?: ServiceEvent | null }) {
	if (payload.event?.type === "message") {
		return { kind: "reply", text: "Listener saw a message" };
	}
	return { kind: "none" };
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
const payload = raw ? JSON.parse(raw) : { event: null };
console.log(JSON.stringify(exec(payload)));
