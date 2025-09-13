// src/middleware/router.test.ts
import { buildMiddleware } from "./router.ts";

Deno.test("buildMiddleware returns a Composer instance with use method", () => {
  const composer = buildMiddleware();
  if (
    !composer ||
    typeof (composer as unknown as { use: unknown }).use !== "function"
  ) {
    throw new Error("Composer should have a use method");
  }
});
