# Pubky Telegram Bot Scaffold

Minimal scaffold with grammY, middleware, and core stubs, plus smoke tests.

## Prereqs

- Deno 1.44+

## Run (long polling)

```sh
BOT_TOKEN=123:abc deno task dev
```

## Run (webhook)

```sh
BOT_TOKEN=123:abc deno task serve
```

## Test

```sh
deno task test
```

Note: tests don't depend on network; they only exercise local stubs.
