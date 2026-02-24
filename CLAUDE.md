# Pubky Bot Builder — Telegram

A Deno-based Telegram bot framework with sandboxed service execution and Pubky decentralized storage integration. Services are isolated in zero-permission Deno subprocesses and communicate via stdin/stdout JSON.

## Quick Reference

- **Runtime:** Deno (not Node.js)
- **Framework:** grammY (Telegram bot library)
- **Database:** SQLite (via deno.land/x/sqlite)
- **Language:** TypeScript (strict)
- **Formatting:** Tabs, 100 char line width (`deno fmt`)
- **Linting:** `deno lint` (recommended rules)
- **Testing:** `deno test`
- **Dev:** `deno task dev` (polling mode with --watch)
- **Prod:** `deno task serve` (webhook mode)
- **Fresh start:** Delete `bot.sqlite` to force snapshot/bundle rebuild

## Architecture

```
Telegram → grammY Bot → Router Middleware → Dispatcher
                                                ↓
                                          Snapshot (routing table)
                                                ↓
                                          Sandbox Host (Deno subprocess, zero permissions)
                                                ↓
                                          Service Bundle (SDK + service code)
                                                ↓
                                          ServiceResponse → Telegram Adapter → User
```

### Core Flow
1. Telegram update arrives (polling or webhook)
2. Router handles admin commands (`/start`, `/setconfig`, `/updateconfig`) or dispatches to services
3. Dispatcher loads routing snapshot for the chat, finds matching service route
4. Service bundle (pre-bundled SDK + service code) runs in isolated Deno subprocess
5. Service returns `ServiceResponse` via stdout JSON
6. Response adapter converts to Telegram API calls

## Project Structure

```
src/
├── main.ts                    # Entry point (polling vs webhook)
├── bot.ts                     # Bot init, middleware composition
├── core/
│   ├── config.ts              # Environment config
│   ├── config/store.ts        # SQLite persistence (configs, snapshots, bundles)
│   ├── config/migrations.ts   # DB schema management
│   ├── dispatch/dispatcher.ts # Event routing → sandbox execution → state mgmt
│   ├── sandbox/host.ts        # Deno subprocess with zero permissions
│   ├── snapshot/snapshot.ts   # Config → routing table, caching (memory + SQLite)
│   ├── state/state.ts         # In-memory state (chatId+userId+serviceId keyed)
│   ├── pubky/pubky.ts         # Config fetching from Pubky homeserver
│   ├── pubky/writer.ts        # Admin-approval write queue
│   ├── pubky/writer_store.ts  # Writer SQLite persistence
│   ├── ttl/store.ts           # Message auto-deletion scheduling
│   └── util/
│       ├── bundle.ts          # Inline SDK + service into data URL
│       ├── logger.ts          # Structured JSON logging
│       └── npm_allowlist.ts   # Allowed npm packages for services
├── middleware/
│   ├── router.ts              # Command routing, admin commands
│   ├── response.ts            # ServiceResponse → Telegram API
│   └── admin.ts               # Permission checks
├── adapters/
│   ├── registry.ts            # Service registry
│   └── telegram/
│       ├── adapter.ts         # Telegram API integration
│       └── ui_converter.ts    # UI abstraction → Telegram format
└── types/
    ├── routing.ts             # RoutingSnapshot, CommandRoute, ListenerRoute
    ├── sandbox.ts             # ExecutePayload, sandbox types
    └── services.ts            # Service protocol types

packages/
├── sdk/                       # Service SDK (bundled into every service)
│   ├── mod.ts                 # Public API surface
│   ├── service.ts             # defineService() + ServiceDefinition
│   ├── events.ts              # CommandEvent, CallbackEvent, MessageEvent
│   ├── state.ts               # state.replace/merge/clear()
│   ├── responses/
│   │   ├── types.ts           # ServiceResponse union type
│   │   ├── factory.ts         # reply(), edit(), photo(), pubkyWrite(), etc.
│   │   └── guards.ts          # Type guards
│   ├── ui.ts                  # UIBuilder, UIKeyboard, UIMenu, UICard, UICarousel
│   ├── i18n.ts                # Internationalization
│   ├── runner.ts              # runService() — sandbox entry point (stdin→stdout)
│   └── schema.ts              # JSON Schema validation types
├── demo_services/             # Example services (hello, survey, links, listener, etc.)
├── core_services/             # Production services
│   └── event-creator/         # Eventky event creation with multi-step flow
│       ├── mod.ts             # Service entry point (defineService)
│       ├── handlers/          # Command, callback, message handlers
│       ├── flows/             # Optional menu, calendar, location, edit, submit
│       ├── utils/             # Calendar, validation, preview, URL builders
│       ├── constants.ts       # Service ID, schemas, validation, replace groups
│       └── types.ts           # EventCreatorState, EventCreatorConfig
└── eventky-specs/             # Local implementation of eventky data utilities
    └── mod.ts                 # URI builders, ID generation, validation, types
```

## Import Aliases (deno.json)

```
@core/     → ./src/core/
@middleware/ → ./src/middleware/
@adapters/ → ./src/adapters/
@schema/   → ./src/types/
@sdk/      → ./packages/sdk/
@eventky/  → ./packages/eventky-specs/
```

## Key Concepts

### Services
Services are isolated units of bot functionality. Four kinds:

| Kind | Description | State |
|------|-------------|-------|
| `single_command` | One-shot response | None |
| `command_flow` | Multi-step conversation | Persistent until `state.clear()` |
| `listener` | Responds to any message | None |
| `periodic_command` | Scheduled (not yet implemented) | N/A |

Services are defined with `defineService()` from the SDK and have handlers for `command`, `callback`, and `message` events. Network access: declare `net: ["domain.com"]` in `PubkyServiceSpec` → flows through `BaseRoute.net` → `SandboxCaps.net` → `--allow-net=domain.com` on the subprocess.

### Sandbox Security Model
Services run in Deno subprocesses with **zero permissions by default**:
- `--allow-read=/tmp` always granted (bundles stored as temp files)
- `--allow-read=$DENO_CACHE,/tmp` for npm services (need cached modules)
- `--allow-net=domain1,domain2` only if service declares `net: ["domain"]` in spec
- No env vars — subprocess gets minimal env: `HOME`, `PATH`, `DENO_DIR`, `XDG_CACHE_HOME`
- Communication via stdin (JSON payload) → stdout (JSON response)
- Timeout enforcement (max 20s; default 2s for commands, 10s if net-enabled)
- Console output redirected to stderr in runner to avoid polluting JSON

### Snapshot System
Routing snapshots map commands → service bundles. Three-layer cache:
1. In-memory (10s TTL per chatId)
2. SQLite (keyed by config hash)
3. Content-addressed bundles (SHA-256 deduplication)

### State Management
- Scope: `(chatId, userId, serviceId)` — in-memory only, lost on restart
- Directives: `state.replace(val)`, `state.merge(val)`, `state.clear()`
- Active flows tracked per user to route messages to the correct service

### PubkyWriter (Admin Approval)
Services can call `pubkyWrite(path, data, preview)` to write to Pubky homeserver:
- Writes queued, previewed to admin Telegram group with clickable user links
- Admin reacts to approve/reject; timeout after `PUBKY_APPROVAL_TIMEOUT` (default 24h)
- Writer loads keypair from recovery file, strips "pubky" prefix from `publicKey.toString()`
- Handles Telegram image downloads → blob upload → file record → event write
- URIs follow pubky-app-specs format: `pubky://<z32_pk>/pub/<app>/<resource>/<id>`

### Configuration Templates
Bot configs define which services are active per chat. Sources:
- Built-in templates: `default`, `modular`, `fake`, `bad`
- File paths: `./path/to/config.json`
- Pubky URLs: `pubky://pk/pub/bot_builder/configs/id.json` (modular configs from web configurator)

Per-chat config stored in SQLite, switchable via `/setconfig <id>`.

Modular config resolution (`resolveModularBotConfig` in `pubky.ts`):
1. Fetches bot config from Pubky URL
2. Resolves each `ServiceReference.serviceConfigRef` → fetches service config
3. Merges overrides (command, config, datasets)
4. Enriches calendar names from Pubky homeserver
5. Normalizes calendar URIs to correct format
6. Returns combined services + listeners for snapshot building

## SQLite Tables

- `chat_configs` — per-chat config template selection
- `snapshots_by_config` — cached routing snapshots by config hash
- `service_bundles` — content-addressed bundled service code
- `ttl_messages` — scheduled message auto-deletion
- `pubky_pending_writes` — admin approval queue

## Environment Variables

```bash
BOT_TOKEN                  # Required: Telegram bot token
NODE_ENV                   # development | production
DEBUG                      # 0 | 1
LOG_MIN_LEVEL              # debug | info | warn | error
LOG_PRETTY                 # 0 | 1
DEFAULT_TEMPLATE_ID        # Config template (default: "default")
WEBHOOK                    # 0 (polling) | 1 (webhook)
LOCAL_DB_URL               # SQLite path (default: ./bot.sqlite)
PUBKY_RECOVERY_FILE        # Path to .pkarr keypair file
PUBKY_PASSPHRASE           # Passphrase for keypair
PUBKY_ADMIN_GROUP          # Telegram group ID for write approvals
PUBKY_APPROVAL_TIMEOUT     # Seconds (default: 86400)
DEFAULT_MESSAGE_TTL        # Auto-delete seconds (0 = disabled)
ENABLE_DELETE_PINNED       # 0 | 1
```

## Companion Project

The **Pubky Bot Configurator** (`../pubky_bot_configurator/`) is a Next.js web UI that lets users create and manage bot configs, service configs, and datasets on their Pubky homeserver. The bot reads those configs at runtime.

## Bundler System (`src/core/util/bundle.ts`)

The bundler inlines all imports (SDK, eventky-specs, relative paths) into a single file for sandbox:

- **Import resolution:** Handles `@sdk/`, `@eventky/`, `./`, `../` imports recursively
- **Relative path resolution:** `resolveRelativePath()` handles `../` by walking the path segments; preserves leading `/` for absolute paths
- **Output:** All services (npm and non-npm) written to temp files in `/tmp` (not data URLs — OS ARG_MAX limit)
- **npm handling:** Uses `deno cache` to pre-fetch allowed npm modules; subprocess gets minimal env to avoid ARG_MAX
- **Content addressing:** SHA-256 hash of final code → `service_bundles` table for deduplication

## SDK Patterns for Services (`packages/sdk/`)

### Response Builders
```
reply(text, opts?)          → Text message
edit(text, opts?)           → Edit existing message
photo(url, opts?)           → Photo with caption
pubkyWrite(path, data, preview) → Queue Pubky write for approval
uiKeyboard(kb, msg, opts?)  → Inline keyboard (MUST use this, not reply + keyboard)
```

### UI Message Management
- `replaceGroup: "group_name"` — Edit previous message in same group (in-place updates)
- `cleanupGroup: "group_name"` — Delete last tracked message in group before sending new one
- `deleteTrigger: true` — Delete the message that triggered this response

### State Directives
```
state.replace(val)  — Overwrite all state
state.merge(val)    — Shallow merge into existing
state.clear()       — Erase state, end flow
```

### UI Keyboard Namespacing
`UIBuilder.keyboard().namespace(serviceId)` prefixes callback data with `svc:<serviceId>|`. The namespace MUST match either a command key or a route's serviceId for callback routing to work.

### Important
- `reply()` only passes `options`, `state`, `deleteTrigger`, `ttl` — spreading `uiKeyboard()` result into reply opts silently drops the keyboard. Always use `uiKeyboard(kb, msg, { state })` directly.
- **Telegram Markdown v1:** Use `*bold*` (single asterisk), NOT `**bold**`. Adapter hardcodes `parse_mode: "Markdown"`.

## Pubky URI Formats

Follow pubky-app-specs exactly:
```
pubky://<z32_public_key>/pub/eventky.app/calendars/<calendarId>
pubky://<z32_public_key>/pub/eventky.app/events/<eventId>
pubky://<z32_public_key>/pub/pubky.app/files/<fileId>
pubky://<z32_public_key>/pub/pubky.app/blobs/<blobId>
```

The public key is a 52-character z-base-32 string (NO "pubky" prefix). `keypair.publicKey.toString()` returns the key WITH "pubky" prefix — must be stripped.

## Development Notes

- Always use `deno fmt` before committing (tabs, 100 char lines)
- Service code changes require snapshot cache invalidation (automatic on content hash change)
- The SDK is fully inlined into service bundles — changes to `packages/sdk/` affect all services
- npm packages in services must be on the allowlist (`src/core/util/npm_allowlist.ts`)
- Tests: `deno task test` — uses Deno's built-in test runner
- Delete `bot.sqlite` to force fresh snapshot rebuild (also clears chat config mappings — run `/setconfig` again)
- Stale bundles in SQLite can persist old code; snapshot builder always upserts on content hash change
- `dispatch.miss` logs at debug level (hidden at default info level) — set `LOG_MIN_LEVEL=debug` to see routing misses
- **JSON config mutations are not a concern** — services are not deployed yet, so breaking changes to config schemas, service definitions, or data formats can be made freely without migration worries
