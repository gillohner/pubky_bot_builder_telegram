// src/core/snapshot/snapshot.ts
// Moved from src/core/snapshot.ts (initial refactor; mock services kept inline for now)
import { log } from "../util/logger.ts";
import { fileToDataUrl } from "../util/data_url.ts";

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

// Paths for example services
const EXAMPLES = {
  hello: "./src/example_services/hello.ts",
  keyboard: "./src/example_services/keyboard.ts",
  photo: "./src/example_services/photo.ts",
  env: "./src/example_services/env_probe.ts",
  listener: "./src/example_services/listener.ts",
  flow: "./src/example_services/flow.ts",
  survey: "./src/example_services/survey.ts",
  links: "./src/example_services/links.ts",
} as const;

export async function buildSnapshot(chatId: string): Promise<RoutingSnapshot> {
  const now = Date.now();
  const cached = snapshotCache.get(chatId);
  if (cached && cached.expires > now) return cached.snapshot;
  await Promise.resolve();
  // Pre-encode example services
  const [
    helloUrl,
    keyboardUrl,
    photoUrl,
    envUrl,
    listenerUrl,
    flowUrl,
    surveyUrl,
    linksUrl,
  ] = await Promise.all([
    fileToDataUrl(EXAMPLES.hello),
    fileToDataUrl(EXAMPLES.keyboard),
    fileToDataUrl(EXAMPLES.photo),
    fileToDataUrl(EXAMPLES.env),
    fileToDataUrl(EXAMPLES.listener),
    fileToDataUrl(EXAMPLES.flow),
    fileToDataUrl(EXAMPLES.survey),
    fileToDataUrl(EXAMPLES.links),
  ]);
  const snapshot: RoutingSnapshot = {
    commands: {
      hello: {
        serviceId: "mock_hello",
        kind: "single_command",
        entry: helloUrl,
        config: { greeting: "Hello from sandbox!" },
      },
      keyboard: {
        serviceId: "mock_keyboard",
        kind: "single_command",
        entry: keyboardUrl,
      },
      photo: {
        serviceId: "mock_photo",
        kind: "single_command",
        entry: photoUrl,
      },
      flow: {
        serviceId: "mock_flow",
        kind: "command_flow",
        entry: flowUrl,
      },
      survey: {
        serviceId: "mock_survey",
        kind: "command_flow",
        entry: surveyUrl,
      },
      links: {
        serviceId: "mock_links",
        kind: "single_command",
        entry: linksUrl,
      },
      env: {
        serviceId: "mock_env_probe",
        kind: "single_command",
        entry: envUrl,
      },
    },
    listeners: [
      {
        serviceId: "mock_listener",
        kind: "listener",
        entry: listenerUrl,
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

// (Flow & survey examples now external in example_services folder)
