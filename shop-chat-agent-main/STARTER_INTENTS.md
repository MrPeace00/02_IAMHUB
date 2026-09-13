# Lazy Chat starter routing

Local implementation on `codex/printify-first`, September 13, 2026. No deployment.

## Root cause and selected architecture

The widget and homepage previously supplied different prose to the same chat
session and LLM tool loop. Both could call Shopify `search_catalog`. The local
catalog priority service enriches Shopify product IDs with vendor metadata and
sorts Printify-vendor products first. That is catalog grouping, not Printify
Choice eligibility or global delivery evidence. If every product has the same
vendor, changing that priority cannot distinguish the starter results. This was
confirmed from code and local fixtures, not a fresh production catalog audit.

The implementation uses a deterministic server dispatcher before AI or account
discovery. The existing Printify client submits and refreshes orders; it is not
an approved source of catalog Choice eligibility, destination coverage, or
customer product mappings. A separate server-only eligibility boundary therefore
returns unavailable. No guessed provider endpoint, response field, token-based
enablement, or external redirect was added.

## Request and response contracts

Both theme interfaces, including homepage suggestion chips, use:

```json
{
  "message": "Check verified Printify Choice global fulfillment options.",
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
general chat flow. Selecting another starter explicitly selects its route.
The Shopify starter is a category-free browse; subsequent refinements use the
existing general chat flow. No persistent global-delivery mode is implied.

Responses retain the SSE `id`, `chunk`, `message_complete`, `product_results`,
and `end_turn` events. A new `starter_result` event includes `intent`, `state`,
`message`, `products`, and an optional machine-readable `reason`. Both interfaces
record intent and state on the assistant element's dataset. Supported states in
this release are `catalog` (ordinary Shopify results, not eligibility verified)
and `unavailable`. No branch emits `verified` or `needs_destination` yet.

## Source behavior and customer URLs

- `shopify_catalog` connects to the existing storefront MCP integration and calls
  `search_catalog` with `{ "catalog": { "query": "" } }`. Vendor metadata uses
  preference `any`. Product cards use the existing formatting and display limit.
  No AI, customer-account discovery, or Printify API is needed for this starter.
- `global_fulfillment` calls `searchGlobalFulfillment` in the server-only
  eligibility boundary. It returns `unavailable` with
  `eligibility_source_not_configured`, no products and an explanation that
  eligibility and delivery coverage cannot currently be verified. It does not
  call Shopify, AI, or the Printify order client. Shopify is offered only as an
  explicit alternative button. The homepage clears previous cards when a new
  starter starts; the chat transcript keeps earlier turns as history.
- Provider exceptions at the dispatcher boundary yield generic unavailable
  messages without exception text or a cross-catalog fallback.
- Shopify starter purchase links must be HTTPS product-page URLs on
  `lazycustoms.com`, `www.lazycustoms.com`, `vbw9zu-f7.myshopify.com`, or
  `lazy-customs-2.myshopify.com`. Relative product paths are accepted. These known
  store aliases canonicalize to `https://lazycustoms.com/products/<handle>`.
  Queries and fragments are removed for this browse action. Unsafe schemes,
  credentials, foreign shops, merchant paths, and encoded-path tricks are
  rejected; cards without an approved URL are omitted. No title-based mapping
  or merchant-dashboard destination is used.

## Configuration and remaining gate

There is **no enabled eligibility source and no new configuration key** in this
release. `PRINTIFY_API_TOKEN` remains the existing server-only order-client key;
its presence cannot enable or verify Global fulfillment. No credentials are
read by this new boundary, serialized to clients, or included in fixtures.

Confirm a real Printify Choice-capable catalog source and its eligibility,
destination, and identity-to-customer-page fields before implementing verified
results. Country normalization and country questions are deliberately deferred:
an absent source cannot verify any destination and must not ask unnecessarily.
The alternative is a product-owner-confirmed customer-facing Printify URL. No
such URL is confirmed here, so no redirect setting or navigation was added.

Provider integration, actual timeout/cancellation, authorization/rate-limit and
malformed-response handling, supported/unsupported destination verification,
and verified-result normalization must be implemented and tested when that
source contract is confirmed. Current exception tests use injected failures at
the service boundary; they are not evidence of a working Printify integration.
The full verified-provider outcome remains blocked; the authorized safe portion
is implemented. Deployment remains prohibited for this task.

## Changed files

| File | Purpose |
| --- | --- |
| `app/services/starter-intent.server.js` | Allowlist, deterministic dispatch, customer product URL validation, sanitized failure states |
| `app/services/global-fulfillment.server.js` | Server-only unavailable eligibility boundary |
| `app/routes/chat.jsx` | Request validation and starter SSE dispatch before the existing general chat flow |
| `app/prompts/prompts.json` | Remove misleading vendor-based Global fulfillment instructions |
| `extensions/chat-bubble/assets/chat.js` | Widget intents, state handling, preserved existing uncommitted widget fixes |
| `extensions/chat-bubble/assets/lazy-home.js` | Homepage button/chip intents and state handling |
| `extensions/chat-bubble/blocks/chat-interface.liquid` and `lazy-home.liquid` | Copy that does not imply verified Choice availability |
| `tests/starter-intent.test.mjs` | Service and POST routing, URL allowlist, errors, missing configuration, request-scoped intent |
| `tests/starter-home.test.mjs` | Executed homepage click-to-request contract and public credential-reference check |
| `tests/widget-backend.test.mjs` | Executed widget click-to-request contract and updated starter-copy expectation |
| `package.json` | Include the new regression tests in the full suite |
| `STARTER_INTENTS.md` | Contracts, scope, configuration gate, and local verification |

## Verification

Focused tests: `node --test tests/starter-intent.test.mjs tests/starter-home.test.mjs tests/widget-backend.test.mjs tests/catalog-priority.test.mjs` — 25 passed.

Commands ran from `shop-chat-agent-main` in PowerShell:

| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `$env:DATABASE_URL='file:./dev.sqlite'; npm test` | PASS — 62 tests, zero failures/skips |
| `npm run typecheck` | PASS |
| `$env:DATABASE_URL='file:./dev.sqlite'; npm run build` | PASS — client and server bundles |
| `git diff --check` | PASS |

The build emitted React Router v8 opt-in notices, empty API-only client chunk
notices, and a mixed static/dynamic database-import warning; none failed the build.

A read-only scan of `build/client`, theme assets, and Liquid source checked 21
files for Printify credential variable references, test-secret markers, and any
available local/environment Printify credential values. It found zero matching
files and printed no secret values. The initial Node module resolution was
blocked by the filesystem sandbox; the approved read-only rerun passed. This
does not establish a rendered merchant-theme check: these local templates were
not published or rendered in a live Shopify theme.

Tests execute route and theme code with service/DOM fakes. They establish source
separation, request compatibility, and failure behavior locally; they do not
establish live browser or production-provider behavior. Existing uncommitted
CSS and verification-log edits were left intact, and existing widget changes
were preserved while adding the intent contract. No commit, push, or deployment
was performed.
