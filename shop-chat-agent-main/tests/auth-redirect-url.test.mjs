import assert from "node:assert/strict";
import test from "node:test";

import { generateAuthUrl } from "../app/auth.server.js";

test("generateAuthUrl fails when REDIRECT_URL is missing", async () => {
  const originalRedirectUrl = process.env.REDIRECT_URL;
  delete process.env.REDIRECT_URL;

  try {
    await assert.rejects(
      generateAuthUrl("conversation", "shop"),
      /REDIRECT_URL is required/,
    );
  } finally {
    if (originalRedirectUrl === undefined) {
      delete process.env.REDIRECT_URL;
    } else {
      process.env.REDIRECT_URL = originalRedirectUrl;
    }
  }
});

test("generateAuthUrl rejects a non-HTTPS REDIRECT_URL", async () => {
  const originalRedirectUrl = process.env.REDIRECT_URL;
  process.env.REDIRECT_URL = "http://example.com/auth/callback";

  try {
    await assert.rejects(
      generateAuthUrl("conversation", "shop"),
      /REDIRECT_URL must use HTTPS/,
    );
  } finally {
    if (originalRedirectUrl === undefined) {
      delete process.env.REDIRECT_URL;
    } else {
      process.env.REDIRECT_URL = originalRedirectUrl;
    }
  }
});

test("generateAuthUrl rejects an invalid REDIRECT_URL", async () => {
  const originalRedirectUrl = process.env.REDIRECT_URL;
  process.env.REDIRECT_URL = "not-a-url";

  try {
    await assert.rejects(generateAuthUrl("conversation", "shop"), TypeError);
  } finally {
    if (originalRedirectUrl === undefined) {
      delete process.env.REDIRECT_URL;
    } else {
      process.env.REDIRECT_URL = originalRedirectUrl;
    }
  }
});
