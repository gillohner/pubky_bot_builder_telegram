// example_services/links.ts
// /links command: shows categories via inline keyboard; callback edits message to show links
// Callback data format: svc:mock_links|c:<index> or svc:mock_links|cancel

interface Category {
  name: string;
  links: { title: string; url: string }[];
}
const CATEGORIES: Category[] = [
  {
    name: "General",
    links: [
      { title: "Pubky", url: "https://pubky.org" },
      { title: "Docs", url: "https://docs.pubky.org" },
    ],
  },
  {
    name: "Community",
    links: [{ title: "Dezentralschweiz", url: "https://dezentralschweiz.org" }],
  },
  {
    name: "Alt Frontends",
    links: [
      { title: "Nitter", url: "https://nitter.net" },
      { title: "ProxiTok", url: "https://proxitok.pabloferreiro.es" },
    ],
  },
];

function catKeyboard(includeCancel = true) {
  const rows = CATEGORIES.map((c, idx) => [
    { text: c.name, callback_data: `svc:mock_links|c:${idx}` },
  ]);
  if (includeCancel)
    rows.push([{ text: "✖ Close", callback_data: "svc:mock_links|cancel" }]);
  return { inline_keyboard: rows };
}

function renderCategory(idx: number): string {
  const cat = CATEGORIES[idx];
  if (!cat) return "Unknown category";
  return (
    `*${cat.name}*\n` +
    cat.links.map((l) => `• [${l.title}](${l.url})`).join("\n")
  );
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
    text: "Select a category:",
    options: { parse_mode: "Markdown", reply_markup: catKeyboard() },
  };
} else if (ev.type === "callback") {
  const data = "data" in ev && typeof ev.data === "string" ? ev.data : "";
  if (/\|cancel$/.test(data)) {
    body = { kind: "delete" };
  } else {
    const match = /\|c:(\d+)/.exec(data);
    const idx = match ? Number(match[1]) : -1;
    body = {
      kind: "edit",
      text: renderCategory(idx),
      options: { parse_mode: "Markdown", reply_markup: catKeyboard() },
    };
  }
}
console.log(JSON.stringify(body));
