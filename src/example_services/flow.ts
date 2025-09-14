// example_services/flow.ts
// Multi-step flow using message continuation

async function main() {
  const dec = new TextDecoder();
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
  const raw = dec.decode(t).trim();
  const payload = raw ? JSON.parse(raw) : { event: null };
  const ev = payload.event || { type: "unknown" };
  const st = ev.state || { step: 0 };
  const step = st.step || 0;
  type Reply = { kind: "reply"; text: string; state?: unknown };
  function r(text: string, state?: unknown): Reply {
    return state ? { kind: "reply", text, state } : { kind: "reply", text };
  }
  let body: Record<string, unknown> = { kind: "none" };
  if (ev.type === "command") {
    if (step === 0)
      body = r("Flow started. Send a message.", {
        op: "replace",
        value: { step: 1 },
      });
    else
      body = r("Flow already active. Send next message.", {
        op: "merge",
        value: { notice: "awaiting" },
      });
  } else if (ev.type === "message") {
    if (step === 1)
      body = r("Got first message. Send another to finish.", {
        op: "replace",
        value: { step: 2, first: ev.message?.text || "n/a" },
      });
    else if (step === 2)
      body = r(
        `Done! First="${st.first || ""}" Second="${ev.message?.text || ""}"`,
        { op: "clear" }
      );
  }
  console.log(JSON.stringify(body));
}
await main();
