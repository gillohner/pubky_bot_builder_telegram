// example_services/env_probe.ts
// Attempts to read env & fs; should be denied in sandbox

interface CommandEvent {
  type: "command";
}
type ServiceEvent = CommandEvent | { type: string };
async function exec(payload: { event?: ServiceEvent | null }) {
  if (payload.event?.type === "command") {
    const diagnostics: string[] = [];
    try {
      diagnostics.push(
        "ENV_BOT_TOKEN=" + (Deno.env.get("BOT_TOKEN") || "MISSING")
      );
    } catch {
      diagnostics.push("env_denied");
    }
    try {
      await Deno.readTextFile("README.md");
      diagnostics.push("read_ok");
    } catch {
      diagnostics.push("read_denied");
    }
    return { kind: "reply", text: "env probe: " + diagnostics.join(",") };
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
console.log(JSON.stringify(await exec(payload)));
