---
applyTo: "**"
---

# Deno Instructions

- use "deno task test" to run tests.
- use "deno lint" to check code style.
- use "deno task dev" to run locally
- use "deno fmt" to format code.

# Current Version

- Deno version: deno 2.5.0 (stable, release, aarch64-apple-darwin)
- v8 version: v8 14.0.365.4-rusty
- TypeScript version: typescript 5.9.2

# Coding Conventions

- Never use type "any"; prefer explicit types or generics.
- Avoid non-null assertions (postfix !); prefer runtime checks.
- Prefer "=== / !==" over "== / !=".
- Write tests for all non-trivial code.
- Use async/await; avoid raw Promises.
- Use modern JS/TS features (optional chaining, nullish coalescing, etc).
- Prefer functional programming patterns (map, filter, reduce) over imperative loops.
- Avoid deeply nested code; prefer early returns and helper functions.
- Use descriptive variable names and keep scopes small.
- Document complex logic with comments.
- Avoid premature optimization; prioritize readability and maintainability.
- Keep dependencies up to date.
- Use consistent coding styles (e.g., spacing, indentation) across the codebase. (Deno fmt)

# Project-Specific Guidelines (Augmented)

## Typing & Structure
- Centralize shared types under `src/types/` (`routing.ts`, `sandbox.ts`, `services.ts`). Add new cross-cutting types there instead of scattering definitions.
- Re-export via focused barrels only when it reduces import churn; avoid overly broad `export *` from directories containing unrelated concerns.
- Do not introduce circular type dependencies; if two types reference each other, extract common subsets into a new leaf type file.
- Avoid `unknown` leakage to service SDK handlers; sanitize and narrow before passing into userland service code.

## Sandbox Payload Contract
- Payload shape passed to sandbox must be: `{ event: { type, token?|data?|message?, state?, stateVersion? }, ctx: { chatId, userId, serviceConfig? }, manifest: { schemaVersion } }`.
- Never wrap the payload inside another object (regression previously caused handler non-execution). Add a regression test when changing this shape.

## State Management
- In-memory state only (`core/state/state.ts`). Always apply state changes through `applyStateDirective` to ensure version increments.
- New flows must use state directives (`replace`, `merge`, `clear`)—direct map mutations are forbidden.
- For future persistent state, include `stateVersion` in sandbox payload to enable optimistic locking.

## Testing Standards
- Each new module with logic branching requires tests: branch coverage for success & failure paths.
- Add negative-path tests for error handling (e.g., missing bundle, unknown command, expired flow) alongside positive tests.
- Prefer fast unit tests (sub-100ms). For sandbox spawning tests, set tight timeouts and isolate via in-memory DB.
- When adding new response kinds, update `middleware/response.ts` and add focused tests mirroring each branch (reply/edit/photo/delete/none/error).
- Regression tests required for: sandbox payload shape, snapshot integrity hashing, state directive application.

## Logging
- Use structured logging via `log.debug/info/warn/error` with concise, stable event keys (e.g., `snapshot.build`, `dispatch.callback.ok`).
- Include only JSON-serializable metadata. Avoid logging entire large objects; prefer hashes or counts.
- Make sure to respect no logging policy in production

## Error Handling
- Return user-safe `ServiceResponse { kind: "error" }` for sandbox/service failures; never throw past dispatcher unless truly unrecoverable.
- Preserve original error message only in logs; sanitize user-facing error text.

## Naming
- Service files: snake with functional intent (e.g., `links.ts`, `survey.ts`). Avoid suffixes like `Service`—context is clear.
- Tests: mirror path and append `_test.ts` (already aligned). For negative/edge tests add a descriptive prefix (e.g., `dispatcher_negative_test.ts`).

## Performance & Caching
- Snapshot cache TTL currently 10s; if adjusting, update related tests and constants in one commit with justification in commit message.
- Bundle hashing must remain pure (hash code, not metadata). If hash algorithm changes, add dual-hash transition logic.

## Adding Capabilities (Future)
- Capability requests from services should map to explicit Deno permission flags. Never grant broad permissions implicitly.
- Introduce net allowlist parsing with validation (host:port). Reject wildcard requests in first iteration.

## Prohibited Patterns
- No dynamic `import()` of remote URLs inside services (enforced by `--no-remote`). Keep it that way until explicit policy exists.
- No filesystem access inside sandbox; if an exception becomes necessary, document capability rationale first.

## Documentation Updates
- When a new architectural feature is implemented (e.g. dataset caching, scheduler), update `docs/DEVELOPMENT_SPEC.md` in the same PR.
- Keep README high-level; deep technical drift tracking lives in the development spec.

## PR Acceptance Checklist (Implied)
- [ ] No `any` / no non-null assertions.
- [ ] Tests added/updated (positive + negative paths).
- [ ] Snapshot & sandbox payload shape unchanged or explicitly versioned.
- [ ] Lint & format clean (`deno lint`, `deno fmt`).
- [ ] No unexpected permission expansions in `deno.json` tasks.

These guidelines should be enforced for all future code assists and refactors.
