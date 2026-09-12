# LAZY CUSTOMS — CURRENT STATE

**Project:** lazycustoms.com — Shopify print-on-demand store with a baby-goods focus and a customer-facing AI chat agent under development  
**Operator:** Mr. Peace Elluvasun Allah Cush-El  
**Store handle used in project:** `lazy-customs-2`  
**Last verified UCP backing hostname:** `vbw9zu-f7.myshopify.com` (reverified September 12, 2026 UTC)
**Updated through:** September 12, 2026 UTC; NR-8-hardened Claude image-to-text rail and React Router 7.18.3 remediation locally verified, plus public catalog/UCP recheck
**Governed by:** LAZY CUSTOMS — STORE AND AGENT ENGINE v4.1 · CHAMPION MASTER ENGINE v5.5

## 1. CURRENT POSITION

The chat-agent backend is deployed in the canonical Railway project `valiant-liberation`; `https://ai.lazycustoms.com/chat?health=true` returned HTTP 200 through the published/configured backend checks on September 12, 2026 UTC. In the local working tree, customer-facing text is routed through `AI_TEXT_PROVIDER`: Claude/Anthropic can serve storefront text, OpenAI remains available as text fallback, and OpenAI remains the artwork-generation rail. A sibling `/vision-copy` route gives uploaded images and just-generated OpenAI artwork one Claude image-to-text path for structured copy or product guidance. It accepts no customer text context, returns fixed generic output when Claude flags identity details, and is locally tested but not deployed or live-verified.

The public storefront/catalog side is no longer password-blocked as of the September 12, 2026 UTC recheck. `check_catalog.py --label 20260912_recheck` reports homepage HTTP 200, password protection inactive, `/products.json` HTTP 200, and 8 products across 1 page. `check_discovery.py --label 20260912_recheck` reports discovery open: homepage HTTP 200, robots.txt HTTP 200 with no blanket disallow, and no homepage noindex. `https://lazycustoms.com/.well-known/ucp` returns HTTP 200 and advertises UCP shopping/catalog/cart/checkout/order capabilities backed by `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`. This supersedes the September 11 password-gate finding for present-tense claims while preserving it as historical evidence.

A complete customer message, selected text provider response, Shopify tool call, product-card return, image upload or generated-image handoff to Claude, cart handoff and OAuth flow still require end-to-end verification after deployment of the current local changes. The password gate is no longer the current blocker; live browser/customer-flow verification still is.

Two outcomes remain distinct:

1. **Machine discovery and transactions:** current UCP publication and catalog responses are verified as reachable on September 12, 2026 UTC. Third-party agent visibility beyond the verified protocol/catalog surface and completed transactions are not verified.
2. **Customer-facing chat:** the fork provides the storefront widget, Claude/OpenAI text routing, OpenAI artwork generation and Shopify MCP client. Backend health is verified; end-to-end conversational commerce is not yet verified.

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
- `extensions/chat-bubble/assets/chat.js` — HTTPS backend validation and bounded health check before enabling chat.
- `extensions/chat-bubble/blocks/chat-interface.liquid` — merchant backend setting; expired default removed from source.
- `scripts/check-connections.mjs` — read-only published/configured backend and catalog diagnostics.
- `tests/*.test.mjs` — 32 focused chat, image-generation, vision-input, MCP-routing, quiz-context and widget/backend tests.
- `connection-check.json` and `MCP-CONNECTION-AUDIT.md` — saved live evidence and audit details.

Verification record: [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md).

## 3. COMMIT RECORD — PUSHED

Local `HEAD` and `origin/main` both resolve to `84180b2`, which contains the initial September 12 Claude vision implementation. The NR-8 hardening and React Router audit remediation described here remain local working-tree changes until committed, pushed, and deployed.

| Commit | Completed work |
|---|---|
| `99c2c3a` | Corrected UCP metadata and tool routing; added cart fallback, result handling, shared policy instructions and routing tests |
| `180de63` | Removed stale widget defaults, added backend health checks and widget tests, and recorded connection evidence |
| `51fb5b7` | Added `VERIFICATION_LOG.md` with five dated entries |
| `382ce67` | Corrected the initial Railway Docker install after the then-missing lockfile |
| `63b0d10` | Migrated customer chat to OpenAI, committed a reproducible lockfile, restored Docker `npm ci`, added tests and deployment documentation |

Pushing code does not deploy the application or update an existing merchant theme setting.

## 4. VALIDATION AND LIVE FINDINGS

### Code checks

| Check | Recorded result |
|---|---|
| Focused application tests | 32 passed after the September 12 NR-8 and dependency reconciliation pass |
| ESLint, typecheck and production build | Passed |
| Production client/SSR build | Passed |
| Railway custom-domain health | HTTP 200; canonical GitHub deployment status successful |
| Current storefront catalog/discovery | Open on September 12, 2026 UTC: password inactive, discovery unrestricted, feed HTTP 200 with 8 products |
| Selected text-provider response, Shopify tool call and customer OAuth | Not verified end to end |

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
| Claude/Anthropic text provider | Implemented locally behind `AI_TEXT_PROVIDER`; needs deployed end-to-end verification before live customer capability claims |
| Claude/Anthropic image-to-text | Implemented locally at `/vision-copy`; uploaded and generated images converge on one validated, metadata-stripped base64 Messages API input. The route accepts no customer text context; strict internal copy/guidance JSON carries an identity flag, and flagged model text is replaced by fixed generic output before return. No Shopify Admin writes. Not deployed or live-verified |
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
| Customer-facing agent described as Concept/nonexistent | Superseded: fork implemented and tested; working deployment remains unverified |
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
| 5 | Agent runtime setup | **Partially resolved:** canonical Railway backend health is live and public catalog/UCP access is reachable. Verify a full widget-to-selected-provider-to-Shopify-tools response, product cards, database persistence and customer OAuth after deploying current changes |
| 6 | UCP publication | **Resolved for current state:** September 12 `.well-known/ucp` returns HTTP 200 with advertised capabilities; recheck before any future external availability claim |
| 7 | Verification log | **Resolved:** file exists and is committed in `51fb5b7` |
| 8 | Expired backend tunnel | **Resolved:** `ai.lazycustoms.com` is configured with verified DNS/TLS, targets Railway port 8080, returns HTTP 200 and is saved in the active theme setting |
| 9 | Push completed commits | **Resolved:** all three commits pushed; operator remote verification and local tracking ref agree |

## 8. DECISIONS LOG

| ID | Decision | Status |
|---|---|---|
| D-001 | Password removal timing | Closed for current state; password is off as of September 12 recheck |
| D-002 | Publish existing supplier inventory before adding products | Previously in motion; product/channel decisions remain open |
| D-003 | Adopt and patch the fork rather than rebuild | Closed; implemented in the existing fork |

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
- No live cart mutation, completed checkout, customer OAuth session or successful full storefront chat response has yet been verified.

## 10. NEXT ACTIONS

1. Commit and deploy the current shared vision and React Router changes, then test both front doors: uploaded image → `/vision-copy` → Claude text and generated OpenAI PNG → opaque reference → `/vision-copy` → Claude text. Also test the complete widget → `/chat` → selected text provider → Shopify tools → widget response path. Treat `/chat?health=true` as reachability only.
2. Record the live verification results with timestamps; a clean pass on `/chat`, both `/vision-copy` front doors, and an identity-bearing image fixture closes OI-5/OI-10 and advances both rails to `integration tested`.
3. Verify customer OAuth, cart handoff and database persistence in production, then run `shopify app deploy` to synchronize application and redirect configuration if it has not already been deployed.
4. Inspect intended baby products individually, including current status and sales-channel assignment; repeat relevant search and lookup checks after any approved changes.
5. Re-observe Knowledge Base gaps; make the operator's intended changes based on current state.
6. Continue recording new evidence in `VERIFICATION_LOG.md`. Initial log creation and completed pushes do not need to be repeated as unresolved tasks.

**Evidence:** [verification log](VERIFICATION_LOG.md), [connection audit](../../shop-chat-agent-main/MCP-CONNECTION-AUDIT.md), [saved connection results](../../shop-chat-agent-main/connection-check.json), September 11 and September 12 evidence files under `ops/evidence/`, application source, and local Git history/tracking ref. Historical admin observations are explicitly separated from newer live checks.
