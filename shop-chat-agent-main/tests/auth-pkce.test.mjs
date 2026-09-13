import assert from "node:assert/strict";
import test from "node:test";

import { exchangeCodeForToken } from "../app/auth-callback.server.js";
import { generateAuthUrl } from "../app/auth.server.js";

const originalEnv = {
  apiKey: process.env.SHOPIFY_API_KEY,
  redirectUrl: process.env.REDIRECT_URL,
};

test.before(() => {
  process.env.SHOPIFY_API_KEY = "test-client-id";
  process.env.REDIRECT_URL = "https://example.com/auth/callback";
});

test.after(() => {
  restoreEnv("SHOPIFY_API_KEY", originalEnv.apiKey);
  restoreEnv("REDIRECT_URL", originalEnv.redirectUrl);
});

test("repeated authorization attempts persist distinct state and request bindings", async () => {
  const rows = [];
  const dependencies = {
    getBaseAuthUrl: async () => "https://shop.example.com/oauth/authorize",
    storeCodeVerifier: async (row) => rows.push(row),
  };

  const first = await generateAuthUrl("conversation-1", "shop-1", dependencies);
  const second = await generateAuthUrl("conversation-1", "shop-1", dependencies);
  const firstState = new URL(first.url).searchParams.get("state");
  const secondState = new URL(second.url).searchParams.get("state");

  assert.notEqual(firstState, secondState);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(({ state, conversationId, shopId }) => ({ state, conversationId, shopId })),
    [
      { state: firstState, conversationId: "conversation-1", shopId: "shop-1" },
      { state: secondState, conversationId: "conversation-1", shopId: "shop-1" },
    ],
  );
});

test("a verifier persistence failure prevents an authorization URL", async () => {
  const writeError = new Error("unique constraint failed");

  await assert.rejects(
    generateAuthUrl("conversation-1", "shop-1", {
      getBaseAuthUrl: async () => "https://shop.example.com/oauth/authorize",
      storeCodeVerifier: async () => {
        throw writeError;
      },
    }),
    writeError,
  );
});

test("callback consumes state once and rejects a replay before token exchange", async () => {
  const rows = new Map([
    ["one-time-state", {
      state: "one-time-state",
      verifier: "one-time-verifier",
      conversationId: "conversation-1",
      shopId: "shop-1",
    }],
  ]);
  let fetchCalls = 0;
  const dependencies = {
    consumeCodeVerifier: async (state) => {
      const row = rows.get(state) ?? null;
      rows.delete(state);
      return row;
    },
    getTokenUrl: async () => "https://shop.example.com/oauth/token",
    fetch: async (_url, options) => {
      fetchCalls += 1;
      assert.equal(
        new URLSearchParams(options.body).get("code_verifier"),
        "one-time-verifier",
      );
      return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };

  const result = await exchangeCodeForToken("authorization-code", "one-time-state", dependencies);
  assert.equal(result.conversationId, "conversation-1");
  assert.equal(fetchCalls, 1);

  await assert.rejects(
    exchangeCodeForToken("authorization-code", "one-time-state", dependencies),
    /invalid, expired, or already consumed/,
  );
  assert.equal(fetchCalls, 1);
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
