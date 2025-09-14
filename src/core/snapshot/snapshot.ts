// src/core/snapshot/snapshot.ts
// Moved from src/core/snapshot.ts (initial refactor; mock services kept inline for now)
import { log } from "../util/logger.ts";

export interface BaseRoute {
  serviceId: string;
  entry: string;
  config?: Record<string, unknown>;
}
export interface CommandRoute extends BaseRoute {
  kind: "single_command" | "command_flow";
}
export interface ListenerRoute extends BaseRoute {
  kind: "listener";
}
export type AnyRoute = CommandRoute | ListenerRoute;
export interface RoutingSnapshot {
  commands: Readonly<Record<string, CommandRoute>>;
  listeners: Readonly<ListenerRoute[]>;
  builtAt: number;
  version: number;
}

const SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_TTL_MS = 10_000;
interface CacheEntry {
  snapshot: RoutingSnapshot;
  expires: number;
}
const snapshotCache = new Map<string, CacheEntry>();

function buildHelloDataUrl(): string {
  const code = `// mock hello service (sandboxed)\ninterface ExecutePayload { event: any; ctx: any }\nasync function readAll(): Promise<string>{const d=new TextDecoder();const cs:Uint8Array[]=[];for await (const c of Deno.stdin.readable)cs.push(c);const t=new Uint8Array(cs.reduce((n,c)=>n+c.length,0));let o=0;for(const c of cs){t.set(c,o);o+=c.length;}return d.decode(t).trim();}\nconst raw=await readAll();const payload= raw? JSON.parse(raw):{event:null,ctx:null};let body:any; if(payload.event?.type==='command'){body={kind:'reply',text:'Hello from sandbox!'};} else { body={kind:'none'};} console.log(JSON.stringify(body));`;
  return encodeDataUrl(code);
}
function buildKeyboardDataUrl(): string {
  const code = `// mock keyboard service (sandboxed)\ninterface ExecutePayload { event: any; ctx: any }\nasync function readAll(): Promise<string>{const d=new TextDecoder();const cs:Uint8Array[]=[];for await (const c of Deno.stdin.readable)cs.push(c);const t=new Uint8Array(cs.reduce((n,c)=>n+c.length,0));let o=0;for(const c of cs){t.set(c,o);o+=c.length;}return d.decode(t).trim();}\nconst raw=await readAll();const payload= raw? JSON.parse(raw):{event:null,ctx:null};let body:any={kind:'none'}; if(payload.event?.type==='command'){ body={kind:'reply',text:'Choose an option',options:{reply_markup:{inline_keyboard:[[ {text:'Photo',callback_data:'demo:1:'+ btoa(JSON.stringify({action:'photo'}))}] ]}}}; } console.log(JSON.stringify(body));`;
  return encodeDataUrl(code);
}
function buildPhotoDataUrl(): string {
  const code = `// mock photo service (sandboxed)\ninterface ExecutePayload { event: any; ctx: any }\nasync function readAll(): Promise<string>{const d=new TextDecoder();const cs:Uint8Array[]=[];for await (const c of Deno.stdin.readable)cs.push(c);const t=new Uint8Array(cs.reduce((n,c)=>n+c.length,0));let o=0;for(const c of cs){t.set(c,o);o+=c.length;}return d.decode(t).trim();}\nconst raw=await readAll();const payload= raw? JSON.parse(raw):{event:null,ctx:null};let body:any={kind:'none'}; if(payload.event?.type==='command'){ body={kind:'photo',photo:'https://nexus.pubky.app/static/files/c5nr657md9g8mut1xhjgf9h3cxaio3et9xyupo4fsgi5f7etocey/0033WXE37S700/feed',caption:'Here is a kitten!'};} console.log(JSON.stringify(body));`;
  return encodeDataUrl(code);
}
function buildFlowDataUrl(): string {
  const code = `// mock command flow service (sandboxed)\ninterface ExecutePayload { event: any; ctx: any }\nasync function readAll(): Promise<string>{const d=new TextDecoder();const cs:Uint8Array[]=[];for await (const c of Deno.stdin.readable)cs.push(c);const t=new Uint8Array(cs.reduce((n,c)=>n+c.length,0));let o=0;for(const c of cs){t.set(c,o);o+=c.length;}return d.decode(t).trim();}\nconst raw=await readAll();const payload= raw? JSON.parse(raw):{event:null,ctx:null};let body:any={kind:'none'}; if(payload.event?.type==='command'){ const token=payload.event.token||''; const step=(token as string).length % 3; if(step===0) body={kind:'reply',text:'Flow step 1 - send /flow again'}; else if(step===1) body={kind:'reply',text:'Flow step 2 - one more /flow'}; else body={kind:'reply',text:'Flow complete!'};} console.log(JSON.stringify(body));`;
  return encodeDataUrl(code);
}
function buildEnvProbeDataUrl(): string {
  const code = `// mock env probe service (sandboxed)\ninterface ExecutePayload { event: any; ctx: any }\nasync function readAll(): Promise<string>{const d=new TextDecoder();const cs:Uint8Array[]=[];for await (const c of Deno.stdin.readable)cs.push(c);const t=new Uint8Array(cs.reduce((n,c)=>n+c.length,0));let o=0;for(const c of cs){t.set(c,o);o+=c.length;}return d.decode(t).trim();}\nconst raw=await readAll();const payload= raw? JSON.parse(raw):{event:null,ctx:null};let body:any={kind:'none'}; if(payload.event?.type==='command'){ const diagnostics:string[]=[]; try{diagnostics.push('ENV_BOT_TOKEN='+(Deno.env.get('BOT_TOKEN')||'MISSING'));}catch{diagnostics.push('env_denied');} try{await Deno.readTextFile('README.md'); diagnostics.push('read_ok');}catch{diagnostics.push('read_denied');} body={kind:'reply',text:'env probe: '+ diagnostics.join(',')}; } console.log(JSON.stringify(body));`;
  return encodeDataUrl(code);
}
function buildListenerDataUrl(): string {
  const code = `// mock listener service (sandboxed)\ninterface ExecutePayload { event: any; ctx: any }\nasync function readAll(): Promise<string>{const d=new TextDecoder();const cs:Uint8Array[]=[];for await (const c of Deno.stdin.readable)cs.push(c);const t=new Uint8Array(cs.reduce((n,c)=>n+c.length,0));let o=0;for(const c of cs){t.set(c,o);o+=c.length;}return d.decode(t).trim();}\nconst raw=await readAll();const payload= raw? JSON.parse(raw):{event:null,ctx:null};let body:any={kind:'none'}; if(payload.event?.type==='message'){ body={kind:'reply',text:'Listener saw a message'};} console.log(JSON.stringify(body));`;
  return encodeDataUrl(code);
}
function encodeDataUrl(code: string): string {
  return `data:application/typescript;base64,${btoa(code)}`;
}

export async function buildSnapshot(chatId: string): Promise<RoutingSnapshot> {
  const now = Date.now();
  const cached = snapshotCache.get(chatId);
  if (cached && cached.expires > now) return cached.snapshot;
  await Promise.resolve();
  const snapshot: RoutingSnapshot = {
    commands: {
      hello: {
        serviceId: "mock_hello",
        kind: "single_command",
        entry: buildHelloDataUrl(),
        config: { greeting: "Hello from sandbox!" },
      },
      keyboard: {
        serviceId: "mock_keyboard",
        kind: "single_command",
        entry: buildKeyboardDataUrl(),
      },
      photo: {
        serviceId: "mock_photo",
        kind: "single_command",
        entry: buildPhotoDataUrl(),
      },
      flow: {
        serviceId: "mock_flow",
        kind: "command_flow",
        entry: buildFlowDataUrl(),
      },
      env: {
        serviceId: "mock_env_probe",
        kind: "single_command",
        entry: buildEnvProbeDataUrl(),
      },
    },
    listeners: [
      {
        serviceId: "mock_listener",
        kind: "listener",
        entry: buildListenerDataUrl(),
      },
    ],
    builtAt: now,
    version: SNAPSHOT_SCHEMA_VERSION,
  };
  snapshotCache.set(chatId, { snapshot, expires: now + SNAPSHOT_TTL_MS });
  log.debug("snapshot.build", {
    chatId,
    commands: Object.keys(snapshot.commands).length,
    listeners: snapshot.listeners.length,
  });
  return snapshot;
}
