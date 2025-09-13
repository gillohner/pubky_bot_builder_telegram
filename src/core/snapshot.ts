// src/core/snapshot.ts
// --- Snapshot Types -------------------------------------------------------
// A very small routing snapshot structure we can grow later. For now it only
// contains command routes mapping a normalized command token to a lightweight
// service descriptor with the information required to execute a sandbox run.

export interface CommandRoute {
  serviceId: string;
  kind: "single_command"; // placeholder for future discriminated union
  entry: string; // ESM specifier (jsr:, https:, data: URL, etc.)
  config?: Record<string, unknown>;
}

export interface RoutingSnapshot {
  commands: Readonly<Record<string, CommandRoute>>;
}

// For the initial scaffold we expose one mock command `hello` that resolves
// to a tiny service module embedded as a data: URL. This demonstrates the
// future shape where real service configs will be resolved dynamically.
function buildHelloDataUrl(): string {
  const code = `// mock hello service (sandboxed)\n` +
    `// Reads one JSON line on stdin: { event, ctx } and prints a JSON response.\n` +
    `interface ExecutePayload { event: any; ctx: any }\n` +
    `async function readAll(): Promise<string> {\n` +
    `\tconst dec = new TextDecoder();\n` +
    `\tconst chunks: Uint8Array[] = [];\n` +
    `\tfor await (const c of Deno.stdin.readable) chunks.push(c);\n` +
    `\tconst total = new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));\n` +
    `\tlet off=0; for (const c of chunks){ total.set(c, off); off+=c.length;}\n` +
    `\treturn dec.decode(total).trim();\n` +
    `}\n` +
    `const raw = await readAll();\n` +
    `const payload = raw ? JSON.parse(raw) as ExecutePayload : {event:null,ctx:null};\n` +
    `let body: any;\n` +
    `if (payload.event?.type === 'command') {\n` +
    `\tbody = { kind: 'reply', text: 'Hello from sandbox!' };\n` +
    `} else {\n` +
    `\tbody = { kind: 'none' };\n` +
    `}\n` +
    `console.log(JSON.stringify(body));\n`;
  const b64 = btoa(code);
  return `data:application/typescript;base64,${b64}`;
}

export async function buildSnapshot(_chatId: string): Promise<RoutingSnapshot> {
  // Future implementation: load DEFAULT_CONFIG_URL / chat overrides, merge, cache
  await Promise.resolve();
  return {
    commands: {
      hello: {
        serviceId: "mock_hello",
        kind: "single_command",
        entry: buildHelloDataUrl(),
        config: { greeting: "Hello from sandbox!" },
      },
    },
  };
}
