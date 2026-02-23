# Pubky Bot Builder — Telegram

A Deno-based Telegram bot framework with sandboxed service execution and Pubky decentralized storage integration.

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
├── core_services/             # Production services (event-creator, url-cleaner, etc.)
└── eventky-specs/             # Pubky event data specs (WASM)
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

Services are defined with `defineService()` from the SDK and have handlers for `command`, `callback`, and `message` events.

### Sandbox Security Model
Services run in Deno subprocesses with **zero permissions**:
- No network, no filesystem (except `/tmp` for reading bundle), no env vars, no remote imports
- Communication via stdin (JSON payload) → stdout (JSON response)
- Timeout enforcement (max 20 seconds, default 2 seconds)

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
Services can call `pubkyWrite(path, data, preview)` to write to Pubky homeserver. Writes are queued, previewed to an admin Telegram group, and require manual approval before execution.

### Configuration Templates
Bot configs define which services are active per chat. Sources:
- Built-in templates: `default`, `modular`, `fake`, `bad`
- File paths: `./path/to/config.json`
- Pubky URLs: `pubky://pk/pub/bot_builder/configs/id.json`

Per-chat config stored in SQLite, switchable via `/setconfig <id>`.

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

## Development Notes

- Always use `deno fmt` before committing (tabs, 100 char lines)
- Service code changes require snapshot cache invalidation (automatic on content hash change)
- The SDK is fully inlined into service bundles — changes to `packages/sdk/` affect all services
- npm packages in services must be on the allowlist (`src/core/util/npm_allowlist.ts`)
- Tests: `deno task test` — uses Deno's built-in test runner
- **JSON config mutations are not a concern** — services are not deployed yet, so breaking changes to config schemas, service definitions, or data formats can be made freely without migration worries
