import assert from "node:assert/strict";
import test from "node:test";

import { getAuthConfirmationNext, sanitizeNextPath } from "./auth-config.ts";

test("sanitized next paths preserve local paths and query strings", () => {
  assert.equal(sanitizeNextPath("/team-lidor/schedule?view=agenda"), "/team-lidor/schedule?view=agenda");
});

test("sanitized next paths reject external redirects", () => {
  assert.equal(sanitizeNextPath("https://example.com/steal"), "/");
  assert.equal(sanitizeNextPath("//example.com/steal"), "/");
});

test("recovery confirmation always goes to the password update page", () => {
  assert.equal(getAuthConfirmationNext("recovery", "/team-lidor"), "/account/update-password");
});

test("non-recovery confirmation keeps a sanitized next path", () => {
  assert.equal(getAuthConfirmationNext("email", "/team-lidor"), "/team-lidor");
});
