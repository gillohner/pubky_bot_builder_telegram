# Pubky Telegram Bot Builder (Deno)

VERY EARLY DEVELOPMENT! Below is already inaccurate!

Lightweight experimental framework for composing Telegram bot services (commands, flows, listeners)
executed inside a constrained sandbox with a routing snapshot and a simple in-memory state layer.

## Pubky Structure

1. Bot Chat Config

```json
{
	"id": "0000000000000",
	"description": "Default Bot Config",
	"version": "1.0.0",
	"created_at": 1731171234,
	"services": [
		{
			"src": "pubky://{pub}/pub/pubky-bot-builder/service-configs/0000000000001.json",
			"overrides": { "time_window_days": 30 },
			"expose": true,
			"admin_only": false
		}
	],
	"listeners": [
		{
			"service_config_ref": "pubky://{pub}/pub/pubky-bot-builder/service-configs/0000000000003.json"
		}
	],
	"periodic": [
		{
			"service_config_ref": "pubky://{pub}/pub/pubky-bot-builder/service-configs/0000000000004.json"
		}
	]
}
```

2. Service Config

```json
{
	"id": "0000000000001",
	"name": "Meetups Flow",
	"kind": "command_flow",
	"created_at": 1731171200,
	"source": {
		"type": "jsr",
		"package": "@gillohner/meetups_flow",
		"version": "1.0.0"
	},
	"capabilities": {
		"allowNetwork": true,
		"networkAllowlist": ["meetstr.com"],
		"timeoutMs": 20000
	},
	"config": {
		"command": "/meetups",
		"description": "Browse and filter meetups",
		"datasets": {
			"cal": "pubky://{pub}/pub/pubky-bot-builder/datasets/0000000000002.json"
		},
		"timezone": "Europe/Zurich"
	}
}
```

Alternative (Git fallback, pinned commit only):

```json
{
	"id": "0000000000001",
	"name": "Meetups Flow",
	"kind": "command_flow",
	"created_at": 1731171200,
	"source": {
		"type": "git",
		"repo": "https://github.com/example/meetups-flow.git",
		"commit": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
		"entry": "src/index.ts"
	},
	"capabilities": {
		/* ... */
	},
	"default_config": {
		/* ... */
	}
}
```

3. Dataset (links with categories)

```json
{
	"id": "0000000000002",
	"name": "Community Links",
	"created_at": 1731171100,
	"kind": "dataset",
	"schema": "links@1",
	"data": {
		"categories": [
			{
				"name": "General",
				"links": [
					{ "title": "Pubky", "url": "https://pubky.org" },
					{ "title": "Docs", "url": "https://docs.pubky.org" }
				]
			},
			{
				"name": "Community",
				"links": [
					{ "title": "Dezentralschweiz", "url": "https://dezentralschweiz.ch" }
				]
			}
		]
	}
}
```

## Monorepo Structure (Current)

```
packages/
  sdk/                 # Published SDK (service definition, responses, ui, events, state directives)
src/
  core/                # Snapshot, dispatch, state (in-memory), sandbox security, config + migrations
  middleware/          # Router, response/application wiring, admin helpers
  adapters/            # Platform adapters (telegram, future: discord, etc.)
  demo_services/       # Example services (hello, flow, survey, etc.)
  bot.ts               # Telegram bot bootstrap using adapter
  main.ts              # Entry point
```

All service-related types (responses, state directives, sandbox payload contract, service kinds) now
live exclusively in the SDK. Runtime code imports them via the `@sdk/` import map alias. The legacy
`src/types/services.ts` has been reduced to a deprecation shim and will be removed in a future
release.

### Database Migrations

The SQLite layer (`core/config/store.ts`) now uses a lightweight migration framework:

- Migrations are defined in `core/config/migrations.ts` as `{ id, name, up }` objects.
- A `migrations` table records applied migrations (idempotent; only runs new ones).
- `initDb()` runs all pending migrations after setting pragmatic PRAGMAs (WAL + NORMAL sync).
- Baseline migration (`id:1`) created initial schema. Migration `id:2` removed the legacy per-chat
  `snapshots` table; only config-hash keyed snapshots are retained.

Add a new migration by appending to the `migrations` array with the next integer id. Keep each
migration self-contained and forward-only (no down migrations—prefer additive changes or follow-up
cleanup migrations). Tests (`migrations_test.ts`) assert idempotency.

## Features

- Snapshot-driven routing (commands + listeners) via config-hash keyed reusable snapshots
- Sandboxed service execution (data: URLs; future: remote bundles)
- In-memory state for multi-step command flows (no database; deliberately ephemeral)
- Active flow sessions: after invoking a `command_flow` once, plain chat messages are routed to it
  until it clears state
- Inline keyboard + callback query wiring (extensible)
- Structured logging + centralized config
- Minimal service protocol with schema versioning
- Content-addressed service bundles (deduplicated by hash)
- Unified SDK-exported service protocol & response types (single source of truth)
- SQLite migration framework (tracked, idempotent)
- Snapshot integrity hashing & source signature tracking
- Snapshot invalidation & orphan bundle garbage collection utilities (per-chat snapshot table
  removed)

## Active Flow Sessions (No Repeated /command Needed)

When a user runs a `command_flow` (e.g. `/flow` or `/survey`) the service can emit a state
directive:

- `replace` or `merge` => activates the flow for that chat
- `clear` => deactivates the flow

While a flow is active, any non-command message in the chat is routed directly back to that flow
service with the latest persisted state. The service returns a response plus (optionally) a new
state directive to progress or finish.

### Session Lifecycle

1. User sends `/flow`
2. Service responds with a prompt and `state: { op: 'replace', value: { step: 1 } }` -> activates
   flow
3. User sends free-form text (no leading slash)
4. Dispatcher detects active flow and routes the message event (including current state)
5. Flow returns updated state; remains active or clears to finish

### State Persistence Philosophy

State is intentionally memory-only. Reasons:

- Keeps architecture trivial; restart = clean slate.
- Encourages flows that recover gracefully or are short-lived.
- Avoids hidden durability assumptions in examples.

If long-term durability or multi-instance scaling becomes a requirement, a future redesign can
introduce a persistence adapter. Service code already uses declarative state directives
(`clear | replace | merge`) so adding a backend later would be localized to the state module.

### Inline Keyboards & Edits

Service replies can include arbitrary Telegram `reply_markup` via the `options` field. Edit
responses (`kind: 'edit'`) attempt to edit the triggering message; if that fails they fall back to a
new reply.

## Writing a Flow Service

Inside the sandbox a service receives a payload (stable contract tested by regression tests):

```
{
  event: { type: 'command' | 'message' | 'callback', token?, data?, message?, state?, stateVersion? },
  ctx: { chatId, userId, serviceConfig? }
}
```

Return one of the response kinds plus an optional `state` directive:

```
{ kind: 'reply', text: 'Next step...', state: { op: 'merge', value: { step: 2 } } }
```

Clearing state ends the active session:

```
{ kind: 'reply', text: 'All done!', state: { op: 'clear' } }
```

## Testing

Run all tests:

```
deno task test
```

New tests demonstrate active flow progression without re-sending `/flow`.

## Extending

Planned next steps (PRs welcome):

- Persistence adapter interface + example (SQLite / KV)
- Capability enforcement (network, crypto scoping)
- Scheduled / periodic commands
- Locale & timezone injection
- Rich media batching

## State & Flow Notes

The state subsystem supports per-user active flow sessions and optional TTLs for automatic expiry
(`ttlMs` in `setActiveFlow`). Scaling beyond a single process would require introducing a real
persistence layer (not included) and converting the synchronous API to an async variant. Until then,
horizontal scaling means sticky routing of all updates for a `(chatId,userId)` pair to the same
process.

Operational suggestions (even for in-memory):

1. TTL & Expiration: assign reasonable timeouts and periodically call `sweepExpiredFlows()`.
2. Memory discipline: keep state small; clear aggressively when done.
3. Versioning: rely on the built-in `version` counter for debugging migrations.
4. Testing: cover invalid input loops, callback edits, and cancellation paths.

### Flow Authoring Tips

- Always emit a state directive when advancing steps (explicit progression).
- Use `merge` for additive updates, `replace` for deterministic state shapes.
- Use `clear` to finalize & free memory; dispatcher unregisters active flow pointer automatically.
- Validate user input; stay in current step on invalid data.

### Ephemeral Image Handling (Survey Example)

The enhanced `survey` service shows how a flow can accept either a Telegram photo upload or a raw
URL without persisting binary data:

1. Earlier steps collect structured answers (color via inline keyboard callback, animal via
   validated text).
2. Image step inspects the incoming message:

- If it contains a `photo` array, select the largest size's `file_id` (Telegram caches the media).
- Else if text matches `^https?://` treat it as an external image URL.
- Otherwise respond with an `edit` prompting the user again (state not advanced).

3. Final response uses `kind: 'photo'` with the `file_id` (or URL) and issues
   `state: { op: 'clear' }` to terminate the flow.

Benefits:

- No need to download or store bytes; state holds only small identifiers.
- `file_id` reuse keeps bandwidth low and is stable for the bot.
- Easy to later swap in a persistence layer if long-term storage becomes necessary.

Extension ideas:

- Add a size/type whitelist by fetching `getFile` metadata (requires net capability and host
  allowance).
- Enforce TTL for pending image steps; auto-expire with `sweepExpiredFlows()`.
- Provide a cancel button that returns a `delete` response kind.

### Roadmap Ideas

- Async backend support
- Rate limiting & quota per user
- Background compaction / pruning
- Metrics exporter (Prometheus/OpenTelemetry)
- Pluggable serialization hooks

If you later need durable state, introduce a new module (e.g. `state/persisted.ts`) with async
primitives and adjust dispatcher code; avoid prematurely widening the current sync API.

## Security Notes

Sandbox currently executes data URL code with restricted permissions (no fs/env). Always review
untrusted service code before inclusion.

## Snapshot Integrity & Invalidation

Each snapshot persisted now includes:

- `integrity`: SHA-256 of the canonical JSON form (with `integrity` omitted before hashing)
- `sourceSig`: Stable SHA-256 derived from the sorted list of referenced service bundle hashes

On load, if an integrity mismatch is detected it is logged and the snapshot is rebuilt. Rebuilds
also recompute the content-addressed bundles for services (one per service source).

Maintenance helpers (exported from `@core/snapshot`):

- `invalidateSnapshotByConfigHash(configHash)` – remove a persisted snapshot so next dispatch
  rebuilds it.
- `gcOrphanBundles()` – delete bundles not referenced by any snapshot (returns `{ deleted, kept }`).

Tests cover: invalidation, orphan GC, and automatic bundle re-generation after manual deletion.

## Barrel Modules

Each major directory now exposes a `mod.ts` re-exporting its public surface to simplify packaging
and external consumption.

## License

MIT (experimental).
