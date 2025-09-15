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

Deno Style Guide

Note

Note that this is the style guide for internal runtime code in the Deno runtime, and in the Deno Standard Library. This is not meant as a general style guide for users of Deno.

Copyright Headers Jump to heading#

Most modules in the repository should have the following copyright header:

// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

If the code originates elsewhere, ensure that the file has the proper copyright headers. We only allow MIT, BSD, and Apache licensed code.
Use underscores, not dashes in filenames Jump to heading#

Example: Use file_server.ts instead of file-server.ts.
Add tests for new features Jump to heading#

Each module should contain or be accompanied by tests for its public functionality.
TODO Comments Jump to heading#

TODO comments should usually include an issue or the author's github username in parentheses. Example:

// TODO(ry): Add tests.
// TODO(#123): Support Windows.
// FIXME(#349): Sometimes panics.

Meta-programming is discouraged. Including the use of Proxy Jump to heading#

Be explicit, even when it means more code.

There are some situations where it may make sense to use such techniques, but in the vast majority of cases it does not.
Inclusive code Jump to heading#

Please follow the guidelines for inclusive code outlined at https://chromium.googlesource.com/chromium/src/+/HEAD/styleguide/inclusive_code.md.
Rust Jump to heading#

Follow Rust conventions and be consistent with existing code.
TypeScript Jump to heading#

The TypeScript portion of the code base is the standard library std.
Use TypeScript instead of JavaScript Jump to heading#
Do not use the filename index.ts/index.js Jump to heading#

Deno does not treat "index.js" or "index.ts" in a special way. By using these filenames, it suggests that they can be left out of the module specifier when they cannot. This is confusing.

If a directory of code needs a default entry point, use the filename mod.ts. The filename mod.ts follows Rust's convention, is shorter than index.ts, and doesn't come with any preconceived notions about how it might work.
Exported functions: max 2 args, put the rest into an options object Jump to heading#

When designing function interfaces, stick to the following rules.

    A function that is part of the public API takes 0-2 required arguments, plus (if necessary) an options object (so max 3 total).

    Optional parameters should generally go into the options object.

    An optional parameter that's not in an options object might be acceptable if there is only one, and it seems inconceivable that we would add more optional parameters in the future.

    The 'options' argument is the only argument that is a regular 'Object'.

    Other arguments can be objects, but they must be distinguishable from a 'plain' Object runtime, by having either:
        a distinguishing prototype (e.g. Array, Map, Date, class MyThing).
        a well-known symbol property (e.g. an iterable with Symbol.iterator).

    This allows the API to evolve in a backwards compatible way, even when the position of the options object changes.

// BAD: optional parameters not part of options object. (#2)
export function resolve(
  hostname: string,
  family?: "ipv4" | "ipv6",
  timeout?: number,
): IPAddress[] {}

// GOOD.
export interface ResolveOptions {
  family?: "ipv4" | "ipv6";
  timeout?: number;
}
export function resolve(
  hostname: string,
  options: ResolveOptions = {},
): IPAddress[] {}

export interface Environment {
  [key: string]: string;
}

// BAD: `env` could be a regular Object and is therefore indistinguishable
// from an options object. (#3)
export function runShellWithEnv(cmdline: string, env: Environment): string {}

// GOOD.
export interface RunShellOptions {
  env: Environment;
}
export function runShellWithEnv(
  cmdline: string,
  options: RunShellOptions,
): string {}

// BAD: more than 3 arguments (#1), multiple optional parameters (#2).
export function renameSync(
  oldname: string,
  newname: string,
  replaceExisting?: boolean,
  followLinks?: boolean,
) {}

// GOOD.
interface RenameOptions {
  replaceExisting?: boolean;
  followLinks?: boolean;
}
export function renameSync(
  oldname: string,
  newname: string,
  options: RenameOptions = {},
) {}

// BAD: too many arguments. (#1)
export function pwrite(
  fd: number,
  buffer: ArrayBuffer,
  offset: number,
  length: number,
  position: number,
) {}

// BETTER.
export interface PWrite {
  fd: number;
  buffer: ArrayBuffer;
  offset: number;
  length: number;
  position: number;
}
export function pwrite(options: PWrite) {}

Note: When one of the arguments is a function, you can adjust the order flexibly. See examples like Deno.serve, Deno.test, Deno.addSignalListener. See also this post.
Export all interfaces that are used as parameters to an exported member Jump to heading#

Whenever you are using interfaces that are included in the parameters or return type of an exported member, you should export the interface that is used. Here is an example:

// my_file.ts
export interface Person {
  name: string;
  age: number;
}

export function createPerson(name: string, age: number): Person {
  return { name, age };
}

// mod.ts
export { createPerson } from "./my_file.ts";
export type { Person } from "./my_file.ts";

Minimize dependencies; do not make circular imports Jump to heading#

Although std has no external dependencies, we must still be careful to keep internal dependencies simple and manageable. In particular, be careful not to introduce circular imports.
If a filename starts with an underscore: _foo.ts, do not link to it Jump to heading#

There may be situations where an internal module is necessary but its API is not meant to be stable or linked to. In this case prefix it with an underscore. By convention, only files in its own directory should import it.
Use JSDoc for exported symbols Jump to heading#

We strive for complete documentation. Every exported symbol ideally should have a documentation line.

If possible, use a single line for the JSDoc. Example:

/** foo does bar. */
export function foo() {
  // ...
}

It is important that documentation is easily human-readable, but there is also a need to provide additional styling information to ensure generated documentation is more rich text. Therefore JSDoc should generally follow markdown markup to enrich the text.

While markdown supports HTML tags, it is forbidden in JSDoc blocks.

Code string literals should be braced with the back-tick (`) instead of quotes. For example:

/** Import something from the `deno` module. */

Do not document function arguments unless they are non-obvious of their intent (though if they are non-obvious intent, the API should be considered anyways). Therefore @param should generally not be used. If @param is used, it should not include the type as TypeScript is already strongly-typed.

/**
 * Function with non-obvious param.
 * @param foo Description of non-obvious parameter.
 */

Vertical spacing should be minimized whenever possible. Therefore, single-line comments should be written as:

/** This is a good single-line JSDoc. */

And not:

/**
 * This is a bad single-line JSDoc.
 */

Code examples should utilize markdown format, like so:

/** A straightforward comment and an example:
 * ```ts
 * import { foo } from "deno";
 * foo("bar");
 * ```
 */

Code examples should not contain additional comments and must not be indented. It is already inside a comment. If it needs further comments, it is not a good example.
Resolve linting problems using directives Jump to heading#

Currently, the building process uses dlint to validate linting problems in the code. If the task requires code that is non-conformant to linter use deno-lint-ignore <code> directive to suppress the warning.

// deno-lint-ignore no-explicit-any
let x: any;

This ensures the continuous integration process doesn't fail due to linting problems, but it should be used scarcely.
Each module should come with a test module Jump to heading#

Every module with public functionality foo.ts should come with a test module foo_test.ts. A test for a std module should go in std/tests due to their different contexts; otherwise, it should just be a sibling to the tested module.
Unit Tests should be explicit Jump to heading#

For a better understanding of the tests, function should be correctly named as it's prompted throughout the test command. Like:

foo() returns bar object ... ok

Example of test:

import { assertEquals } from "@std/assert";
import { foo } from "./mod.ts";

Deno.test("foo() returns bar object", function () {
  assertEquals(foo(), { bar: "bar" });
});

Note: See tracking issue for more information.
Top-level functions should not use arrow syntax Jump to heading#

Top-level functions should use the function keyword. Arrow syntax should be limited to closures.

Bad:

export const foo = (): string => {
  return "bar";
};

Good:

export function foo(): string {
  return "bar";
}

Regular functions and arrow functions have different behavior with respect to hoisting, binding, arguments, and constructability. The function keyword clearly indicates the intent to define a function, improving legibility and tracibility while debugging.
Error Messages Jump to heading#

User-facing error messages raised from JavaScript / TypeScript should be clear, concise, and consistent. Error messages should be in sentence case but should not end with a period. Error messages should be free of grammatical errors and typos and written in American English.

Note

Note that the error message style guide is a work in progress, and not all the error messages have been updated to conform to the current styles.

Error message styles that should be followed:

    Messages should start with an upper case:

Bad: cannot parse input
Good: Cannot parse input

    Messages should not end with a period:

Bad: Cannot parse input.
Good: Cannot parse input

    Message should use quotes for values for strings:

Bad: Cannot parse input hello, world
Good: Cannot parse input "hello, world"

    Message should state the action that lead to the error:

Bad: Invalid input x
Good: Cannot parse input x

    Active voice should be used:

Bad: Input x cannot be parsed
Good: Cannot parse input x

    Messages should not use contractions:

Bad: Can't parse input x
Good: Cannot parse input x

    Messages should use a colon when providing additional information. Periods should never be used. Other punctuation may be used as needed:

Bad: Cannot parse input x. value is empty
Good: Cannot parse input x: value is empty

    Additional information should describe the current state, if possible, it should also describe the desired state in an affirmative voice:

Bad: Cannot compute the square root for x: value must not be negative
Good: Cannot compute the square root for x: current value is ${x}
Better: Cannot compute the square root for x as x must be >= 0: current value is ${x}

std Jump to heading#
Do not depend on external code. Jump to heading#

https://jsr.io/@std is intended to be baseline functionality that all Deno programs can rely on. We want to guarantee to users that this code does not include potentially unreviewed third-party code.
Document and maintain browser compatibility. Jump to heading#

If a module is browser-compatible, include the following in the JSDoc at the top of the module:

// This module is browser-compatible.

Maintain browser compatibility for such a module by either not using the global Deno namespace or feature-testing for it. Make sure any new dependencies are also browser compatible.
Prefer # over private keyword Jump to heading#

We prefer the private fields (#) syntax over private keyword of TypeScript in the standard modules codebase. The private fields make the properties and methods private even at runtime. On the other hand, private keyword of TypeScript guarantee it private only at compile time and the fields are publicly accessible at runtime.

Good:

class MyClass {
  #foo = 1;
  #bar() {}
}

Bad:

class MyClass {
  private foo = 1;
  private bar() {}
}

Naming convention Jump to heading#

Use camelCase for functions, methods, fields, and local variables. Use PascalCase for classes, types, interfaces, and enums. Use UPPER_SNAKE_CASE for static top-level items, such as string, number, bigint, boolean, RegExp, arrays of static items, records of static keys and values, etc.

Good:

function generateKey() {}

let currentValue = 0;

class KeyObject {}

type SharedKey = {};

enum KeyType {
  PublicKey,
  PrivateKey,
}

const KEY_VERSION = "1.0.0";

const KEY_MAX_LENGTH = 4294967295;

const KEY_PATTERN = /^[0-9a-f]+$/;

Bad:

function generate_key() {}

let current_value = 0;

function GenerateKey() {}

class keyObject {}

type sharedKey = {};

enum keyType {
  publicKey,
  privateKey,
}

const key_version = "1.0.0";

const key_maxLength = 4294967295;

const KeyPattern = /^[0-9a-f]+$/;

When the names are in camelCase or PascalCase, always follow the rules of them even when the parts of them are acronyms.

Note: Web APIs use uppercase acronyms (JSON, URL, URL.createObjectURL() etc.). Deno Standard Library does not follow this convention.

Good:

class HttpObject {
}

Bad:

class HTTPObject {
}

Good:

function convertUrl(url: URL) {
  return url.href;
}

Bad:

function convertURL(url: URL) {
  return url.href;
}
Deno Style Guide

Note

Note that this is the style guide for internal runtime code in the Deno runtime, and in the Deno Standard Library. This is not meant as a general style guide for users of Deno.

Copyright Headers Jump to heading#

Most modules in the repository should have the following copyright header:

// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

If the code originates elsewhere, ensure that the file has the proper copyright headers. We only allow MIT, BSD, and Apache licensed code.
Use underscores, not dashes in filenames Jump to heading#

Example: Use file_server.ts instead of file-server.ts.
Add tests for new features Jump to heading#

Each module should contain or be accompanied by tests for its public functionality.
TODO Comments Jump to heading#

TODO comments should usually include an issue or the author's github username in parentheses. Example:

// TODO(ry): Add tests.
// TODO(#123): Support Windows.
// FIXME(#349): Sometimes panics.

Meta-programming is discouraged. Including the use of Proxy Jump to heading#

Be explicit, even when it means more code.

There are some situations where it may make sense to use such techniques, but in the vast majority of cases it does not.
Inclusive code Jump to heading#

Please follow the guidelines for inclusive code outlined at https://chromium.googlesource.com/chromium/src/+/HEAD/styleguide/inclusive_code.md.
Rust Jump to heading#

Follow Rust conventions and be consistent with existing code.
TypeScript Jump to heading#

The TypeScript portion of the code base is the standard library std.
Use TypeScript instead of JavaScript Jump to heading#
Do not use the filename index.ts/index.js Jump to heading#

Deno does not treat "index.js" or "index.ts" in a special way. By using these filenames, it suggests that they can be left out of the module specifier when they cannot. This is confusing.

If a directory of code needs a default entry point, use the filename mod.ts. The filename mod.ts follows Rust's convention, is shorter than index.ts, and doesn't come with any preconceived notions about how it might work.
Exported functions: max 2 args, put the rest into an options object Jump to heading#

When designing function interfaces, stick to the following rules.

    A function that is part of the public API takes 0-2 required arguments, plus (if necessary) an options object (so max 3 total).

    Optional parameters should generally go into the options object.

    An optional parameter that's not in an options object might be acceptable if there is only one, and it seems inconceivable that we would add more optional parameters in the future.

    The 'options' argument is the only argument that is a regular 'Object'.

    Other arguments can be objects, but they must be distinguishable from a 'plain' Object runtime, by having either:
        a distinguishing prototype (e.g. Array, Map, Date, class MyThing).
        a well-known symbol property (e.g. an iterable with Symbol.iterator).

    This allows the API to evolve in a backwards compatible way, even when the position of the options object changes.

// BAD: optional parameters not part of options object. (#2)
export function resolve(
  hostname: string,
  family?: "ipv4" | "ipv6",
  timeout?: number,
): IPAddress[] {}

// GOOD.
export interface ResolveOptions {
  family?: "ipv4" | "ipv6";
  timeout?: number;
}
export function resolve(
  hostname: string,
  options: ResolveOptions = {},
): IPAddress[] {}

export interface Environment {
  [key: string]: string;
}

// BAD: `env` could be a regular Object and is therefore indistinguishable
// from an options object. (#3)
export function runShellWithEnv(cmdline: string, env: Environment): string {}

// GOOD.
export interface RunShellOptions {
  env: Environment;
}
export function runShellWithEnv(
  cmdline: string,
  options: RunShellOptions,
): string {}

// BAD: more than 3 arguments (#1), multiple optional parameters (#2).
export function renameSync(
  oldname: string,
  newname: string,
  replaceExisting?: boolean,
  followLinks?: boolean,
) {}

// GOOD.
interface RenameOptions {
  replaceExisting?: boolean;
  followLinks?: boolean;
}
export function renameSync(
  oldname: string,
  newname: string,
  options: RenameOptions = {},
) {}

// BAD: too many arguments. (#1)
export function pwrite(
  fd: number,
  buffer: ArrayBuffer,
  offset: number,
  length: number,
  position: number,
) {}

// BETTER.
export interface PWrite {
  fd: number;
  buffer: ArrayBuffer;
  offset: number;
  length: number;
  position: number;
}
export function pwrite(options: PWrite) {}

Note: When one of the arguments is a function, you can adjust the order flexibly. See examples like Deno.serve, Deno.test, Deno.addSignalListener. See also this post.
Export all interfaces that are used as parameters to an exported member Jump to heading#

Whenever you are using interfaces that are included in the parameters or return type of an exported member, you should export the interface that is used. Here is an example:

// my_file.ts
export interface Person {
  name: string;
  age: number;
}

export function createPerson(name: string, age: number): Person {
  return { name, age };
}

// mod.ts
export { createPerson } from "./my_file.ts";
export type { Person } from "./my_file.ts";

Minimize dependencies; do not make circular imports Jump to heading#

Although std has no external dependencies, we must still be careful to keep internal dependencies simple and manageable. In particular, be careful not to introduce circular imports.
If a filename starts with an underscore: _foo.ts, do not link to it Jump to heading#

There may be situations where an internal module is necessary but its API is not meant to be stable or linked to. In this case prefix it with an underscore. By convention, only files in its own directory should import it.
Use JSDoc for exported symbols Jump to heading#

We strive for complete documentation. Every exported symbol ideally should have a documentation line.

If possible, use a single line for the JSDoc. Example:

/** foo does bar. */
export function foo() {
  // ...
}

It is important that documentation is easily human-readable, but there is also a need to provide additional styling information to ensure generated documentation is more rich text. Therefore JSDoc should generally follow markdown markup to enrich the text.

While markdown supports HTML tags, it is forbidden in JSDoc blocks.

Code string literals should be braced with the back-tick (`) instead of quotes. For example:

/** Import something from the `deno` module. */

Do not document function arguments unless they are non-obvious of their intent (though if they are non-obvious intent, the API should be considered anyways). Therefore @param should generally not be used. If @param is used, it should not include the type as TypeScript is already strongly-typed.

/**
 * Function with non-obvious param.
 * @param foo Description of non-obvious parameter.
 */

Vertical spacing should be minimized whenever possible. Therefore, single-line comments should be written as:

/** This is a good single-line JSDoc. */

And not:

/**
 * This is a bad single-line JSDoc.
 */

Code examples should utilize markdown format, like so:

/** A straightforward comment and an example:
 * ```ts
 * import { foo } from "deno";
 * foo("bar");
 * ```
 */

Code examples should not contain additional comments and must not be indented. It is already inside a comment. If it needs further comments, it is not a good example.
Resolve linting problems using directives Jump to heading#

Currently, the building process uses dlint to validate linting problems in the code. If the task requires code that is non-conformant to linter use deno-lint-ignore <code> directive to suppress the warning.

// deno-lint-ignore no-explicit-any
let x: any;

This ensures the continuous integration process doesn't fail due to linting problems, but it should be used scarcely.
Each module should come with a test module Jump to heading#

Every module with public functionality foo.ts should come with a test module foo_test.ts. A test for a std module should go in std/tests due to their different contexts; otherwise, it should just be a sibling to the tested module.
Unit Tests should be explicit Jump to heading#

For a better understanding of the tests, function should be correctly named as it's prompted throughout the test command. Like:

foo() returns bar object ... ok

Example of test:

import { assertEquals } from "@std/assert";
import { foo } from "./mod.ts";

Deno.test("foo() returns bar object", function () {
  assertEquals(foo(), { bar: "bar" });
});

Note: See tracking issue for more information.
Top-level functions should not use arrow syntax Jump to heading#

Top-level functions should use the function keyword. Arrow syntax should be limited to closures.

Bad:

export const foo = (): string => {
  return "bar";
};

Good:

export function foo(): string {
  return "bar";
}

Regular functions and arrow functions have different behavior with respect to hoisting, binding, arguments, and constructability. The function keyword clearly indicates the intent to define a function, improving legibility and tracibility while debugging.
Error Messages Jump to heading#

User-facing error messages raised from JavaScript / TypeScript should be clear, concise, and consistent. Error messages should be in sentence case but should not end with a period. Error messages should be free of grammatical errors and typos and written in American English.

Note

Note that the error message style guide is a work in progress, and not all the error messages have been updated to conform to the current styles.

Error message styles that should be followed:

    Messages should start with an upper case:

Bad: cannot parse input
Good: Cannot parse input

    Messages should not end with a period:

Bad: Cannot parse input.
Good: Cannot parse input

    Message should use quotes for values for strings:

Bad: Cannot parse input hello, world
Good: Cannot parse input "hello, world"

    Message should state the action that lead to the error:

Bad: Invalid input x
Good: Cannot parse input x

    Active voice should be used:

Bad: Input x cannot be parsed
Good: Cannot parse input x

    Messages should not use contractions:

Bad: Can't parse input x
Good: Cannot parse input x

    Messages should use a colon when providing additional information. Periods should never be used. Other punctuation may be used as needed:

Bad: Cannot parse input x. value is empty
Good: Cannot parse input x: value is empty

    Additional information should describe the current state, if possible, it should also describe the desired state in an affirmative voice:

Bad: Cannot compute the square root for x: value must not be negative
Good: Cannot compute the square root for x: current value is ${x}
Better: Cannot compute the square root for x as x must be >= 0: current value is ${x}

std Jump to heading#
Do not depend on external code. Jump to heading#

https://jsr.io/@std is intended to be baseline functionality that all Deno programs can rely on. We want to guarantee to users that this code does not include potentially unreviewed third-party code.
Document and maintain browser compatibility. Jump to heading#

If a module is browser-compatible, include the following in the JSDoc at the top of the module:

// This module is browser-compatible.

Maintain browser compatibility for such a module by either not using the global Deno namespace or feature-testing for it. Make sure any new dependencies are also browser compatible.
Prefer # over private keyword Jump to heading#

We prefer the private fields (#) syntax over private keyword of TypeScript in the standard modules codebase. The private fields make the properties and methods private even at runtime. On the other hand, private keyword of TypeScript guarantee it private only at compile time and the fields are publicly accessible at runtime.

Good:

class MyClass {
  #foo = 1;
  #bar() {}
}

Bad:

class MyClass {
  private foo = 1;
  private bar() {}
}

Naming convention Jump to heading#

Use camelCase for functions, methods, fields, and local variables. Use PascalCase for classes, types, interfaces, and enums. Use UPPER_SNAKE_CASE for static top-level items, such as string, number, bigint, boolean, RegExp, arrays of static items, records of static keys and values, etc.

Good:

function generateKey() {}

let currentValue = 0;

class KeyObject {}

type SharedKey = {};

enum KeyType {
  PublicKey,
  PrivateKey,
}

const KEY_VERSION = "1.0.0";

const KEY_MAX_LENGTH = 4294967295;

const KEY_PATTERN = /^[0-9a-f]+$/;

Bad:

function generate_key() {}

let current_value = 0;

function GenerateKey() {}

class keyObject {}

type sharedKey = {};

enum keyType {
  publicKey,
  privateKey,
}

const key_version = "1.0.0";

const key_maxLength = 4294967295;

const KeyPattern = /^[0-9a-f]+$/;

When the names are in camelCase or PascalCase, always follow the rules of them even when the parts of them are acronyms.

Note: Web APIs use uppercase acronyms (JSON, URL, URL.createObjectURL() etc.). Deno Standard Library does not follow this convention.

Good:

class HttpObject {
}

Bad:

class HTTPObject {
}

Good:

function convertUrl(url: URL) {
  return url.href;
}

Bad:

function convertURL(url: URL) {
  return url.href;
}

