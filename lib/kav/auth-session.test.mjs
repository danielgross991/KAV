import assert from "node:assert/strict";
import test from "node:test";

import { getAuthResponseMetadata, shouldRedirectToLogin } from "./auth-session.ts";

test("Supabase response metadata preserves cookies and cache headers", () => {
  const cookies = [
    { name: "sb-project-auth-token.0", value: "first", path: "/" },
    { name: "sb-project-auth-token.1", value: "second", path: "/" },
  ];
  const response = {
    cookies: { getAll: () => cookies },
    headers: new Headers({
      "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0",
      expires: "0",
      pragma: "no-cache",
      "x-unrelated": "ignored",
    }),
  };

  assert.deepEqual(getAuthResponseMetadata(response), {
    cookies,
    headers: [
      ["cache-control", "private, no-cache, no-store, must-revalidate, max-age=0"],
      ["expires", "0"],
      ["pragma", "no-cache"],
    ],
  });
});

test("protected routes redirect only when claims are absent", () => {
  assert.equal(shouldRedirectToLogin("/team-lidor/schedule", false), true);
  assert.equal(shouldRedirectToLogin("/team-lidor/schedule", true), false);
  assert.equal(shouldRedirectToLogin("/login", false), false);
  assert.equal(shouldRedirectToLogin("/logo.svg", false), false);
  assert.equal(shouldRedirectToLogin("/opengraph-image", false), false);
  assert.equal(shouldRedirectToLogin("/twitter-image", false), false);
});
