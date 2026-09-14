# Lazy Chat starter routing

Branch `claude/sharp-franklin-4q9u8d`, September 14, 2026. Committed and pushed.
Not deployed — no Railway redeploy and no Shopify extension release were performed.

Supersedes the September 13 revision written on `codex/printify-first`, which
returned `unavailable` for every Global fulfillment request. That behavior was
correct about evidence and wrong as a product: it told customers there was no
global fulfillment at all, when what is actually unverified is narrower.

## Root cause

The widget and the homepage previously sent different prose into the same chat
session and the same LLM tool loop, so both starters produced whatever the model
did with a sentence. That is the "run together" problem, and it is fixed by the
deterministic server dispatcher described below.

The second problem is not a code problem. **Lazy Customs has one catalog.**
There is no second Printify-hosted product source to route the Global
fulfillment button at, and Printify Choice is an order-routing option applied at
fulfillment, not a browsable storefront. So the two starters necessarily read
the same catalog. They are separated by which products they keep, what each one
may claim, and which code path serves them — not by pretending a second catalog
exists.

## What each source may claim

| | Shopify | Global fulfillment |
| --- | --- | --- |
| Products | whole catalog, any provider | only products whose vendor metadata marks them Printify-made |
| May state | these are store products | these are produced and shipped through the Printify print network |
| May never state | — | Choice routing, Choice eligibility, or delivery coverage for any country |
| Asks for a delivery country | no | no — no connected source can check coverage, so the answer cannot be acted on |

Vendor metadata comes from the store's own `/products.json`, enriched onto
catalog results by `catalog-priority.server.js`. A `Printify` vendor label
establishes that Printify makes the product. It does not establish Printify
Choice routing, per-product Choice eligibility, or destination coverage.

## Request and response contracts

Both theme interfaces, including homepage suggestion chips, use:

```json
{
  "message": "Show me products made for global fulfillment.",
  "intent": "global_fulfillment",
  "conversation_id": "existing-conversation",
  "prompt_type": "systemShopping"
}
```

`intent` is either `global_fulfillment` or `shopify_catalog`. The server and both
static assets have matching allowlists, covered by tests. Unknown values,
including explicit null, return HTTP 400 before source calls. Messages must be
nonempty strings. Existing fields remain supported.

Intent is request-scoped. The server never infers or inherits it from prompt
wording, conversation history, or `prompt_type`. Ordinary typed chat, quiz
requests, and subsequent free-form messages omit intent and retain the existing
general chat flow.

Responses retain the SSE `id`, `chunk`, `message_complete`, `product_results`,
and `end_turn` events. The `starter_result` event carries `intent`, `state`,
`message`, `products`, an optional machine-readable `reason`, and — on the
Global fulfillment success path — `fulfillment: "printify_network"`. States are
`catalog` and `unavailable`. No branch emits `verified`.

Neither starter invokes the AI service or customer-account discovery. Both read
the storefront catalog through the existing MCP integration with
`{ "catalog": { "query": "" } }` and provider preference `any`.

## Failure states

| `reason` | Meaning |
| --- | --- |
| `vendor_metadata_unavailable` | The vendor enrichment read failed, so no product's maker is known. Reported as unreadable, never as "there are none." |
| `no_printify_fulfilled_products` | Vendor data was read and no product is Printify-made. |
| `provider_unavailable` | The Global fulfillment source threw. No fallback to the unfiltered catalog. |
| `catalog_unavailable` | The Shopify starter's catalog read threw. |

Exceptions at the dispatcher boundary yield generic messages with no provider
exception text and no cross-source fallback.

## Customer URLs

Shopify starter purchase links must be HTTPS product-page URLs on
`lazycustoms.com`, `www.lazycustoms.com`, `vbw9zu-f7.myshopify.com`, or
`lazy-customs-2.myshopify.com`. Relative product paths are accepted. These known
store aliases canonicalize to `https://lazycustoms.com/products/<handle>`.
Queries and fragments are removed. Unsafe schemes, credentials, foreign shops,
merchant paths, and encoded-path tricks are rejected; cards without an approved
URL are omitted. No title-based mapping or merchant-dashboard destination is
used.

**Open:** the canonicalization assumes all three hosts serve the same store and
the same product handles. That rests on the project record
(`CURRENT_STATE.md` lines 5-6, `07-repo-audit.md` line 110), not on a live
check. Two `curl -I` requests for one known handle per alias would settle it.

## The remaining gate: verified Choice eligibility

There is **no enabled eligibility source and no new configuration key**.
`PRINTIFY_API_TOKEN` remains the existing server-only order-client key; its
presence cannot enable or verify Choice eligibility. No credentials are read by
the Global fulfillment boundary, serialized to clients, or included in fixtures.

To close the gate, the real Printify product-object field names for eligibility
and destination coverage must be read from the live API, never guessed. Run:

```
PRINTIFY_API_TOKEN=... node scripts/inspect-printify-catalog.mjs
```

It issues GET requests only, redacts any key naming a person or address, and
prints the product object's shape plus the keys that may carry eligibility or
coverage. Its output is the evidence needed to implement verified results.

This must be run from a network that can reach `api.printify.com`. The Claude
Code remote environment cannot: both `api.printify.com` and
`developers.printify.com` return `CONNECT tunnel failed, response 403` from the
egress proxy, and no `PRINTIFY_API_TOKEN` is present there. That is why the
field names were not resolved in this change.

Once the contract is known, implement and test: provider integration, timeout
and cancellation, authorization and rate-limit handling, malformed responses,
supported and unsupported destination verification, and verified-result
normalization. Current exception tests use injected failures at the service
boundary; they are not evidence of a working Printify integration.

## Changed files

| File | Purpose |
| --- | --- |
| `app/services/global-fulfillment.server.js` | Printify-made filtering, the three failure states, and the one message that may be shown with products |
| `app/services/starter-intent.server.js` | Allowlist, deterministic dispatch, shared catalog read, customer product URL validation |
| `app/routes/chat.jsx` | Request validation and starter SSE dispatch before the existing general chat flow |
| `app/prompts/prompts.json` | Free-form chat policy matching the new behavior |
| `extensions/chat-bubble/assets/chat.js`, `lazy-home.js` | Widget and homepage intents, state handling |
| `extensions/chat-bubble/blocks/*.liquid` | Copy that does not imply verified Choice availability |
| `scripts/inspect-printify-catalog.mjs` | Read-only discovery for the eligibility gate |
| `tests/starter-intent.test.mjs` | Source separation, claim limits, failure states, request-scoped intent, POST routing |
| `tests/starter-home.test.mjs` | Homepage click-to-request contract and public credential-reference check |
| `tests/widget-backend.test.mjs` | Widget click-to-request contract; theme copy promises nothing unverified |

## Verification

| Command | Result |
| --- | --- |
| `npm test` | PASS — 63 tests, zero failures, zero skips |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — client and server bundles |

Two tests are written as guards rather than expectations: one asserts that no
Global fulfillment message asks for a delivery country or promises guaranteed
worldwide delivery, and one asserts that no theme asset does either. The first
of these rejected an earlier draft of the customer message, which is the
behavior it was written for.

Tests execute route and theme code with service and DOM fakes. They establish
source separation, request compatibility, and failure behavior locally. They do
not establish live browser behavior or any production-provider behavior. No
deployment was performed.
