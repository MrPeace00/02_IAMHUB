# LAZY CUSTOMS — CURRENT STATE

**Project:** lazycustoms.com — Shopify print-on-demand store with a baby-goods focus and a customer-facing AI chat agent under development  
**Operator:** Mr. Peace Elluvasun Allah Cush-El  
**Store handle used in project:** `lazy-customs-2`  
**Last verified UCP backing hostname:** `vbw9zu-f7.myshopify.com` (reverified September 12, 2026 UTC)
**Updated through:** September 12, 2026 UTC; deployed live chat/vision verification plus Component 1 fulfillment-recorder acceptance at the Tested rung after Champion review and an independent 42/42 local suite rerun
**Governed by:** LAZY CUSTOMS — STORE AND AGENT ENGINE v4.1 · CHAMPION MASTER ENGINE v5.5

## 1. CURRENT POSITION

The chat-agent backend is deployed in the canonical Railway project `valiant-liberation`; `https://ai.lazycustoms.com/chat?health=true` returned HTTP 200 on September 12, 2026 UTC. Source commit `f258473` was on `origin/main` at the final run's start, and the live service exhibited its chat, generation, and vision behavior, but the health endpoint does not expose an exact runtime commit SHA. The source routes customer-facing text through `AI_TEXT_PROVIDER`: Claude/Anthropic can serve storefront text, OpenAI remains available as text fallback, and OpenAI remains the artwork-generation rail. The sibling `/vision-copy` route gives uploaded images and just-generated OpenAI artwork one Claude image-to-text path for structured copy or product guidance. It accepts no customer text context and returns fixed generic output when Claude flags identity details.

The public storefront/catalog side is no longer password-blocked as of the September 12, 2026 UTC recheck. `check_catalog.py --label 20260912_recheck` reports homepage HTTP 200, password protection inactive, `/products.json` HTTP 200, and 8 products across 1 page. `check_discovery.py --label 20260912_recheck` reports discovery open: homepage HTTP 200, robots.txt HTTP 200 with no blanket disallow, and no homepage noindex. `https://lazycustoms.com/.well-known/ucp` returns HTTP 200 and advertises UCP shopping/catalog/cart/checkout/order capabilities backed by `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`. This supersedes the September 11 password-gate finding for present-tense claims while preserving it as historical evidence.

The final September 12 direct-endpoint run completed the defined integration gate: Claude used `search_catalog`, returned two product cards, emitted a `create_cart` tool-use event, confirmed the cart action, and produced a native checkout handoff; uploaded-image and OpenAI-generated-image requests both returned structured Claude copy; and the identity-bearing fixture exactly returned the full NR-8 fallback without any fixture identity term. OI-5 and OI-10 are closed by that operator-defined gate. The SSE stream does not expose the raw Shopify tool result, and no browser/widget interaction, completed purchase, authenticated customer OAuth session, or database-persistence claim follows from this evidence.

Component 1 of the fulfillment work is accepted at the **Tested** rung. Commit `8605ccf` adds an additive, reversible `FulfillmentRecord` migration and an idempotent Printify submission/refresh recorder. NR-11 is structural at both the schema and write-allowlist layers: fulfillment persistence has no customer identity columns and never spreads recipient data into Prisma. The recorder is attached to the Printify service seam but no deployed route or live order event triggers it, so deployment, a genuine Printify Choice response, and a real production database row remain unverified. Component 2 has not started.

Two outcomes remain distinct:

1. **Machine discovery and transactions:** current UCP publication and catalog responses are verified as reachable on September 12, 2026 UTC. Third-party agent visibility beyond the verified protocol/catalog surface and completed transactions are not verified.
2. **Customer-facing chat:** the Claude text, structured quiz, Shopify catalog/product-card/cart handoff, OpenAI artwork, and Claude vision rails are direct-endpoint `integration tested` against the live backend. Browser/widget UI, completed checkout/payment, authenticated customer OAuth, database persistence, and exact Railway runtime SHA remain unverified.

Catalog/product decisions and chat deployment can proceed independently. A successful backend health check by itself does not prove that every intended product is indexed, that the public catalog is reachable, or that a deployed chatbot works; those claims require their own live evidence.

## 2. REPOSITORY STRUCTURE

Repository root: `C:\Users\P\Desktop\02_IAMHUB`.

| Location | Contents |
|---|---|
| `shop-chat-agent-main/` | Active application fork: React Router v7, Shopify OAuth, Prisma, theme extension, configurable Claude/OpenAI text chat and OpenAI artwork generation |
| `_lazycustoms/` | Planning documents, operations scripts and staged additions within the same repository |

**Constraint:** these folders remain siblings. `_lazycustoms` is not nested inside the application.

Key application files:

- `app/mcp-client.js` — discovers tools and routes calls, including UCP agent-profile metadata.
- `app/routes/chat.jsx` — chat route and `GET /chat?health=true` reachability check.
- `app/services/ai.server.js` — text-provider router for Claude/Anthropic or OpenAI.
- `app/services/anthropic.server.js` — streamed Anthropic Messages integration and Shopify tool-use loop.
- `app/services/openai.server.js` and `openai-format.js` — streamed OpenAI Responses integration, history migration and Shopify tool schemas.
- `app/routes/generate-image.jsx` — server-side OpenAI artwork generation with strict CORS and combined session/IP limits.
- `app/routes/vision-copy.jsx` — hardened Claude vision endpoint for structured image copy and streamed product guidance.
- `app/services/vision-image.server.js` — MIME/dimension validation, container metadata stripping and short-lived session-bound generated-image references.
- `app/services/vision-copy.server.js` — Claude vision prompts, strict copy/guidance parsing and generic identity-detail fallbacks; no customer text context is accepted.
- `app/services/tool.server.js` — tool results, errors and UCP product-card formatting.
- `app/services/fulfillment-record.server.js` — telemetry-only, idempotent fulfillment persistence with an explicit write allowlist.
- `app/services/printify.server.js` — Printify submission and refresh seam; records only after successful provider responses.
- `extensions/chat-bubble/assets/chat.js` — HTTPS backend validation and bounded health check before enabling chat.
- `extensions/chat-bubble/blocks/chat-interface.liquid` — merchant backend setting; expired default removed from source.
- `scripts/check-connections.mjs` — read-only published/configured backend and catalog diagnostics.
- `tests/*.test.mjs` — 42 focused auth, fulfillment, chat, image-generation, vision-input, MCP-routing, quiz-context and widget/backend tests.
- `connection-check.json` and `MCP-CONNECTION-AUDIT.md` — saved live evidence and audit details.

Verification record: [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md).

## 3. COMMIT RECORD — PUSHED

Deployed code baseline `f258473` contains the NR-8-hardened vision rail and React Router 7.18.3 remediation. The September 12 live verification was run against that commit; its evidence record is committed separately after the run.

| Commit | Completed work |
|---|---|
| `99c2c3a` | Corrected UCP metadata and tool routing; added cart fallback, result handling, shared policy instructions and routing tests |
| `180de63` | Removed stale widget defaults, added backend health checks and widget tests, and recorded connection evidence |
| `51fb5b7` | Added `VERIFICATION_LOG.md` with five dated entries |
| `382ce67` | Corrected the initial Railway Docker install after the then-missing lockfile |
| `63b0d10` | Migrated customer chat to OpenAI, committed a reproducible lockfile, restored Docker `npm ci`, added tests and deployment documentation |
| `f258473` | Hardened the shared vision rail for NR-8, reconciled OI-9, closed OI-8, and deployed the verified provider/runtime changes |
| `8605ccf` | Added the Component 1 fulfillment recorder, additive/reversible migration, Printify service seam, and focused tests; accepted at Tested, not Production |

Pushing code does not deploy the application or update an existing merchant theme setting.

## 4. VALIDATION AND LIVE FINDINGS

### Code checks

| Check | Recorded result |
|---|---|
| Focused application tests | 32 passed after the September 12 NR-8 and dependency reconciliation pass |
| Current full local suite | 42/42 passed on September 12 after Component 1 acceptance; includes 4/4 fulfillment-recorder tests |
| Component 1 persistence boundary | Champion review verified telemetry-only schema and write allowlist, additive/reversible migration, idempotent upsert, and secret-safe error behavior |
| ESLint, typecheck and production build | Passed |
| Production client/SSR build | Passed |
| Railway custom-domain health | HTTP 200 from `railway-hikari`; exact runtime commit SHA is not exposed by the health response |
| Current storefront catalog/discovery | Open on September 12, 2026 UTC: password inactive, discovery unrestricted, feed HTTP 200 with 8 products |
| Selected text-provider response and Shopify catalog/cart tools | Direct-endpoint live pass: Claude, `search_catalog`, two product cards, `create_cart` invocation, assistant cart confirmation, and native checkout handoff; raw tool result is not emitted |
| Vision upload and OpenAI-to-Claude handoff | Live pass: HTTP 200 structured Claude copy from both front doors |
| NR-8 identity-bearing fixture | Live pass: printed name omitted and fixed generic fallback returned |
| Authenticated customer OAuth, database persistence, completed checkout/payment | Not established by this run |

### Catalog queries

Earlier saved check: September 9, 2026, 01:39 UTC, against `lazycustoms.com`.

| Query | Products returned | Result |
|---|---|---|
| `shirt` | 10 | Success |
| `hoodie` | 10 | Success; another page available |
| Empty browse query | 10 | Success; another page available |
| `baby` | 0 | Success; no diagnostic messages |

The zero-match `baby` result is not evidence of an API outage, a store-wide empty catalog, or the absence of baby tags. Why any particular intended baby product is missing remains unestablished. Product-level status, channel assignment and indexing need inspection before assigning a cause.

Current check: September 12, 2026, 01:08-01:09 UTC. `check_catalog.py` reports password protection inactive, catalog feed HTTP 200, and 8 products. `check_discovery.py` reports discovery unrestricted. `scripts/check-connections.mjs` reports UCP `search_catalog` success for all test queries: `baby` returns 0, `shirt` returns 4, `hoodie` returns 4, and empty browse returns 8. The zero-match `baby` result remains query/product-state evidence, not a store-wide API failure.

### Published widget

The active theme chat backend and `shopify.app.toml` now point to `https://ai.lazycustoms.com`. Railway custom-domain DNS verification and TLS completed, and the health route returns the expected service identity.

This supersedes the expired `plate-proprietary-bottles-cruz.trycloudflare.com` state recorded on September 8. The health route checks backend identity and reachability only; it does not prove Claude/OpenAI response generation, Shopify tool execution, database writes or OAuth readiness.

## 5. COMMERCE MECHANISMS AND ACTUAL ROUTES

| Mechanism | Verified status and scope |
|---|---|
| UCP publication | Reverified September 12, 2026 UTC: `/.well-known/ucp` returns HTTP 200 with UCP shopping/catalog/cart/checkout/order capabilities |
| Storefront MCP | Implemented in the fork as a client of Shopify-hosted servers; policy discovery and lookup were successfully exercised |
| Catalog over UCP MCP | Reverified September 12, 2026 UTC: `search_catalog` calls return `status: success`; empty browse returns 8 products |
| Claude/Anthropic text provider | Deployed behind `AI_TEXT_PROVIDER`; direct-endpoint live request, Shopify catalog tools, product cards, `create_cart` invocation, assistant cart confirmation, and checkout handoff passed on September 12; `integration tested` at that scope. Raw Shopify tool result and browser/widget UI remain unverified |
| Claude/Anthropic image-to-text | Deployed at `/vision-copy`; uploaded and generated images converge on one validated, metadata-stripped base64 Messages API input. Both front doors returned HTTP 200 structured copy, and the identity-bearing fixture produced the fixed generic NR-8 fallback; `integration tested` |
| OpenAI artwork generation | Existing `/generate-image` PNG behavior is preserved; successful responses now also carry an opaque, 15-minute, session-bound image reference for the Claude vision handoff |
| Cloud: Claude AI Assistant | Previously reported installed for merchant back-office work; not rechecked in this update and not the storefront chatbot |

`lazycustoms.com` currently publishes the UCP backing endpoint `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`. Advertised handlers do not establish a tested payment flow.

| Tool group | Discovered route on this store |
|---|---|
| `search_shop_policies_and_faqs` | `/api/mcp` |
| `search_catalog`, `lookup_catalog`, `get_product` | `/api/ucp/mcp` |
| `get_cart`, `create_cart`, `update_cart` | `/api/ucp/mcp` |

The client prefers standard MCP cart tools when advertised, otherwise uses discovered UCP cart tools and their schemas. `/api/mcp` remains in use for policies; it was not replaced wholesale or established as deprecated. Checkout/payment tools are not exposed by these app changes.

## 6. HISTORICAL ADMIN OBSERVATIONS — NOT CURRENT VERIFICATION

The following observations date to September 2, 2026. Re-observe them before acting.

| Historical item | Updated interpretation |
|---|---|
| Agentic sales channel added; management toggles enabled | Current channel settings not rechecked |
| UI reportedly said Agentic Storefronts were not live | Do not generalize to present platform status; this store's UCP publication was later verified and reverified on September 12 |
| Admin catalog feed showed 0 products | Historical observation; September 12 public feed shows 8 products, but intended catalog completeness remains unresolved |
| Knowledge Base: 5 FAQs, 7 unanswered topics, 0 agent queries | Current counts not rechecked |
| Customer-facing agent described as Concept/nonexistent | Superseded: fork implemented, deployed, and integration-tested on September 12 |
| UCP publication unconfirmed | Superseded by September 8 evidence and September 12 recheck |
| Unsaved Preferences password toggle | Superseded by September 12 evidence: password protection is inactive |

## 7. OPEN ITEMS REGISTER

Original item numbers are retained for continuity.

| # | Item | Current status / next action |
|---|---|---|
| 1 | Four previously Draft products: Plush Crib Mobile, Baby Sleep Sack, Nursery Wall Art Plaque, Cotton Baby Bibs | Recheck status; operator decides publish versus keep Draft. Not a proven cause of zero `baby` matches |
| 2 | Previously Active products assigned to zero channels | Recheck assignments and intended channel strategy; inspect specific missing products |
| 3 | Seven previously unanswered Knowledge Base topics | Recheck current gaps and approve merchant answers; do not invent policies |
| 4 | Pending Preferences password toggle | **Resolved for current state:** September 12 probes show password protection inactive; recheck after any future access-setting change |
| 5 | Agent runtime setup | **Closed for the defined direct-endpoint integration gate:** live Claude response, Shopify catalog tools, two product cards, `create_cart` invocation, checkout handoff, both vision endpoints, and NR-8 fixture passed on September 12. Raw cart tool result, browser/widget behavior, database persistence, authenticated OAuth, completed checkout/payment, and exact runtime SHA remain separate unverified claims |
| 6 | UCP publication | **Resolved for current state:** September 12 `.well-known/ucp` returns HTTP 200 with advertised capabilities; recheck before any future external availability claim |
| 7 | Verification log | **Resolved:** file exists and is committed in `51fb5b7` |
| 8 | Expired backend tunnel | **Resolved:** `ai.lazycustoms.com` is configured with verified DNS/TLS, targets Railway port 8080, returns HTTP 200 and is saved in the active theme setting |
| 9 | Push completed commits | **Resolved:** all three commits pushed; operator remote verification and local tracking ref agree |
| 10 | Live quiz/provider/vision verification | **Closed:** all four UTC-stamped direct-endpoint checks passed while `origin/main` matched expected source commit `f258473`; both rails are direct-endpoint `integration tested`, while exact runtime SHA and browser UI remain unverified |
| 11a | Engagement logging and ranking | Open; gated by OI-1/OI-2 catalog hygiene |
| 11b | Automated product creation | Paused by design; Printify field-injection and D-002 reconciliation remain |
| 12 | SEO and structured-data work | Open; blocked by OI-1/OI-2 |
| 13 | NR-8 identity-fixture residual | **Closed:** the printed-name fixture returned no identity detail and used the fixed generic fallback |
| 14 | Component 1 fulfillment recorder | **Met at Tested; live-trigger pending:** local implementation, NR-11 structural boundary, additive/reversible migration, idempotent write, and 42/42 suite are accepted. Deployment, a live order-event trigger, and a real production telemetry row remain Production work |
| 15 | VT-6 physical sample and genuine Printify Choice provider resolution | **Open:** receive the VT-6 hoodie and compare it with the on-screen design; capture one genuine Choice order response to confirm the concrete provider JSON path before relying on automatic enrichment |
| 16 | Fresh-database historical migration replay | **Open, latent DR/fresh-environment issue:** the deployment-representative upgrade passed, but a replay into a brand-new SQLite database reported a generic schema-engine error. Diagnose separately or explicitly accept the rebuild limitation; Component 1's additive migration is not identified as the cause |
| 17 | Binary evidence Git attributes | **Open, repository hygiene/evidence integrity:** the broad `text eol=lf` rule covers PNG fixtures under `ops/evidence/live_runs/**`. Add a narrower PNG `binary` rule before treating cross-checkout fixture bytes as exact; no fix was included in Component 1 acceptance |

## 8. DECISIONS LOG

| ID | Decision | Status |
|---|---|---|
| D-001 | Password removal timing | Closed for current state; password is off as of September 12 recheck |
| D-002 | Publish existing supplier inventory before adding products | Previously in motion; product/channel decisions remain open |
| D-003 | Adopt and patch the fork rather than rebuild | Closed; implemented in the existing fork |
| D-022 | Accept Component 1 at Tested and preserve the Production boundary | Closed at Tested; OI-14 is met at that rung, while OI-15–OI-17 remain open and Component 2 remains gated |

## 9. FACTS, PREFERENCES AND LIMITS

- The client identifies requests with `Agent/LazyCustomsChatAssistant`.
- UCP calls place the profile at `params.arguments.meta.ucp-agent.profile`. The default remains Shopify's public example; `UCP_AGENT_PROFILE_URL` can select a hosted production profile.
- Store policy answers use Shopify's policy tool. Shared assistant instructions do not edit merchant policies or enforce additional checkout rules.
- Runtime prompt keys are `standardAssistant`, `systemShopping`, `systemDesignCoach` and `enthusiasticAssistant`. A standalone `guardrails` prompt key is not present; shared commerce instructions are supplied by the OpenAI service.
- `.env` exists. Its contents and usable credentials were not inspected for this report; file existence is not proof of runtime readiness. `.env.example` documents `AI_TEXT_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `ai.lazycustoms.com` targets; examples are not proof of deployed secrets.
- OI-8 is closed as of September 12 by operator-stated provider-dashboard confirmations: Shopify old app secret rotated and Railway updated, OpenAI old exposed value revoked/inactive with new value live in Railway, and Anthropic old exposed value inactive with new value live in Railway. No secret values are recorded.
- The D-103-era and pre-remediation lockfiles were identical and both held React Router 7.11.0, so the later audit finding was not a rollback; D-103's wording was overbroad. The matched React Router family now resolves to 7.18.3. `npm audit --omit=dev --json` reports 4 high package entries, all in the remaining Prisma/deepmerge chain, whose offered fix is semver-major. OI-9 now tracks only that chain.
- Printify public API availability was previously reported verified; Tapstitch API availability remains an open vendor question. Neither was rechecked here.
- XML remains the recorded preference for Champion-facing modules; “project knowledge files” remains the recorded term for files uploaded into project context.
- A live `create_cart` invocation, assistant cart confirmation, and native checkout handoff were observed. The SSE contract did not expose the raw Shopify tool result. No browser/widget interaction, completed checkout/payment, authenticated customer OAuth session, database-persistence result, or exact Railway runtime SHA has been verified.

## 10. NEXT ACTIONS

1. Resolve the operator-owned OI-1/OI-2 product and channel decisions before starting Component 2.
2. Complete OI-15 physically: inspect the VT-6 hoodie against the on-screen design and capture a genuine Printify Choice order response to verify the provider field path.
3. Diagnose the from-empty migration replay separately (OI-16) and correct the PNG Git attribute rule as an owner-approved repository-hygiene change (OI-17).
4. Re-observe Knowledge Base gaps and make only operator-approved policy changes (OI-3).
5. Verify authenticated customer OAuth and database persistence separately if those capabilities are needed for a stronger production claim; do not infer them from the successful anonymous cart handoff.
6. Keep Phase 3-4 automated product creation paused until OI-11b closes, and continue recording new evidence in `VERIFICATION_LOG.md`.

**Evidence:** [verification log](VERIFICATION_LOG.md), [connection audit](../../shop-chat-agent-main/MCP-CONNECTION-AUDIT.md), [saved connection results](../../shop-chat-agent-main/connection-check.json), September 11 and September 12 evidence files under `ops/evidence/`, application source, and local Git history/tracking ref. Historical admin observations are explicitly separated from newer live checks.
