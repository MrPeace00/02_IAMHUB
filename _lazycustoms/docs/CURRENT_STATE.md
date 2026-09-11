# LAZY CUSTOMS — CURRENT STATE

**Project:** lazycustoms.com — Shopify print-on-demand store with a baby-goods focus and a customer-facing AI chat agent under development  
**Operator:** Mr. Peace Elluvasun Allah Cush-El  
**Store handle used in project:** `lazy-customs-2`  
**Last verified UCP backing hostname:** `vbw9zu-f7.myshopify.com` (historical September 8 evidence; recheck required after password removal)
**Updated through:** September 11, 2026; v4.1 provider-router and quiz-fact maintenance pass in local working tree
**Governed by:** LAZY CUSTOMS — STORE AND AGENT ENGINE v4.1 · CHAMPION MASTER ENGINE v5.5

## 1. CURRENT POSITION

The chat-agent backend is deployed in the canonical Railway project `valiant-liberation`; `https://ai.lazycustoms.com/chat?health=true` returned HTTP 200 again on September 11, 2026. In the local working tree, customer-facing text is routed through `AI_TEXT_PROVIDER`: Claude/Anthropic can serve storefront text, OpenAI remains available as text fallback, and OpenAI remains the artwork-generation rail.

The public storefront/catalog side is currently blocked: September 11 live probes show `https://lazycustoms.com/.well-known/ucp` redirecting to `https://lazycustoms.com/password`, and the catalog/discovery scripts record password protection active. This supersedes the earlier September 8 UCP/catalog-visible evidence for current claims until the password is removed and catalog probes pass again.

A complete customer message, selected text provider response, Shopify tool call, product-card return, cart handoff and OAuth flow still require end-to-end verification after deployment of the current local changes and removal of the storefront password gate.

Two outcomes remain distinct:

1. **Machine discovery and transactions:** earlier UCP publication and catalog responses were verified, but the current September 11 state is password-gated. Third-party agent visibility and completed transactions are not verified.
2. **Customer-facing chat:** the fork provides the storefront widget, Claude/OpenAI text routing, OpenAI artwork generation and Shopify MCP client. Backend health is verified; end-to-end conversational commerce is not yet verified.

Catalog/product decisions and chat deployment can proceed independently. A successful backend health check does not prove that every intended product is indexed, that the public catalog is currently reachable, or that a deployed chatbot works.

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
- `app/services/tool.server.js` — tool results, errors and UCP product-card formatting.
- `extensions/chat-bubble/assets/chat.js` — HTTPS backend validation and bounded health check before enabling chat.
- `extensions/chat-bubble/blocks/chat-interface.liquid` — merchant backend setting; expired default removed from source.
- `scripts/check-connections.mjs` — read-only published/configured backend and catalog diagnostics.
- `tests/*.test.mjs` — 23 focused chat, image-generation, MCP-routing, quiz-context and widget/backend tests.
- `connection-check.json` and `MCP-CONNECTION-AUDIT.md` — saved live evidence and audit details.

Verification record: [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md).

## 3. COMMIT RECORD — PUSHED

At the last pushed record, local `HEAD` and `origin/main` both resolved to `63b0d10`. The September 11 v4.1 maintenance pass is local working-tree work until committed, pushed and deployed.

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
| Focused application tests | 23 passed after the September 11 provider-router/quiz-fact maintenance pass |
| ESLint, typecheck and production build | Passed |
| Production client/SSR build | Passed |
| Railway custom-domain health | HTTP 200; canonical GitHub deployment status successful |
| Current storefront catalog/discovery | Blocked by password protection on September 11, 2026 |
| Selected text-provider response, Shopify tool call and customer OAuth | Not verified end to end |

### Catalog queries

Historical saved check: September 9, 2026, 01:39 UTC, against `lazycustoms.com`.

| Query | Products returned | Result |
|---|---|---|
| `shirt` | 10 | Success |
| `hoodie` | 10 | Success; another page available |
| Empty browse query | 10 | Success; another page available |
| `baby` | 0 | Success; no diagnostic messages |

The zero-match `baby` result is not evidence of an API outage, a store-wide empty catalog, or the absence of baby tags. Why any particular intended baby product is missing remains unestablished. Product-level status, channel assignment and indexing need inspection before assigning a cause.

Current check: September 11, 2026, 17:04 UTC. `check_catalog.py` reports password protection active and catalog ineligible while the storefront password is set. `check_discovery.py` reports discovery restricted because password protection prevents open-web crawling and catalog indexing.

### Published widget

The active theme chat backend and `shopify.app.toml` now point to `https://ai.lazycustoms.com`. Railway custom-domain DNS verification and TLS completed, and the health route returns the expected service identity.

This supersedes the expired `plate-proprietary-bottles-cruz.trycloudflare.com` state recorded on September 8. The health route checks backend identity and reachability only; it does not prove Claude/OpenAI response generation, Shopify tool execution, database writes or OAuth readiness. The storefront password gate prevents treating widget/customer access as fully public today.

## 5. COMMERCE MECHANISMS AND ACTUAL ROUTES

| Mechanism | Verified status and scope |
|---|---|
| UCP publication | Previously verified on September 8; current September 11 probe redirects to `/password` and must pass again after password removal |
| Storefront MCP | Implemented in the fork as a client of Shopify-hosted servers; policy discovery and lookup were successfully exercised |
| Catalog over UCP MCP | Historical searches returned products; current public catalog access is blocked by password protection |
| Claude/Anthropic text provider | Implemented locally behind `AI_TEXT_PROVIDER`; needs deployed end-to-end verification before live customer capability claims |
| Cloud: Claude AI Assistant | Previously reported installed for merchant back-office work; not rechecked in this update and not the storefront chatbot |

Both `lazycustoms.com` and `lazy-customs-2.myshopify.com` previously published the same UCP backing endpoint: `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`. The September 11 public path is password-gated, so recheck the manifest after password removal before making current UCP claims. Advertised handlers do not establish a tested payment flow.

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
| UI reportedly said Agentic Storefronts were not live | Do not generalize to present platform status; this store's UCP publication was later verified but is currently password-gated |
| Admin catalog feed showed 0 products | Historical observation; later UCP searches returned products, but September 11 public catalog/discovery is blocked by password protection |
| Knowledge Base: 5 FAQs, 7 unanswered topics, 0 agent queries | Current counts not rechecked |
| Customer-facing agent described as Concept/nonexistent | Superseded: fork implemented and tested; working deployment remains unverified |
| UCP publication unconfirmed | Superseded by September 8 evidence, but current September 11 state requires recheck after password removal |
| Unsaved Preferences password toggle | Superseded by September 11 evidence: password protection is active |

## 7. OPEN ITEMS REGISTER

Original item numbers are retained for continuity.

| # | Item | Current status / next action |
|---|---|---|
| 1 | Four previously Draft products: Plush Crib Mobile, Baby Sleep Sack, Nursery Wall Art Plaque, Cotton Baby Bibs | Recheck status; operator decides publish versus keep Draft. Not a proven cause of zero `baby` matches |
| 2 | Previously Active products assigned to zero channels | Recheck assignments and intended channel strategy; inspect specific missing products |
| 3 | Seven previously unanswered Knowledge Base topics | Recheck current gaps and approve merchant answers; do not invent policies |
| 4 | Pending Preferences password toggle | **Action needed:** September 11 probes show password protection active; remove it before public catalog/discovery or live widget claims |
| 5 | Agent runtime setup | **Partially resolved:** canonical Railway backend health is live. Verify a full widget-to-selected-provider-to-Shopify-tools response, product cards, database persistence and customer OAuth after deploying current changes and removing the password gate |
| 6 | UCP publication | **Recheck needed:** September 8 manifest was verified, but September 11 `.well-known/ucp` redirects to `/password` |
| 7 | Verification log | **Resolved:** file exists and is committed in `51fb5b7` |
| 8 | Expired backend tunnel | **Resolved:** `ai.lazycustoms.com` is configured with verified DNS/TLS, targets Railway port 8080, returns HTTP 200 and is saved in the active theme setting |
| 9 | Push completed commits | **Resolved:** all three commits pushed; operator remote verification and local tracking ref agree |

## 8. DECISIONS LOG

| ID | Decision | Status |
|---|---|---|
| D-001 | Password removal timing | Recheck current setting before deciding |
| D-002 | Publish existing supplier inventory before adding products | Previously in motion; product/channel decisions remain open |
| D-003 | Adopt and patch the fork rather than rebuild | Closed; implemented in the existing fork |

## 9. FACTS, PREFERENCES AND LIMITS

- The client identifies requests with `Agent/LazyCustomsChatAssistant`.
- UCP calls place the profile at `params.arguments.meta.ucp-agent.profile`. The default remains Shopify's public example; `UCP_AGENT_PROFILE_URL` can select a hosted production profile.
- Store policy answers use Shopify's policy tool. Shared assistant instructions do not edit merchant policies or enforce additional checkout rules.
- Runtime prompt keys are `standardAssistant`, `systemShopping`, `systemDesignCoach` and `enthusiasticAssistant`. A standalone `guardrails` prompt key is not present; shared commerce instructions are supplied by the OpenAI service.
- `.env` exists. Its contents and usable credentials were not inspected for this report; file existence is not proof of runtime readiness. `.env.example` documents `AI_TEXT_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `ai.lazycustoms.com` targets; examples are not proof of deployed secrets.
- Printify public API availability was previously reported verified; Tapstitch API availability remains an open vendor question. Neither was rechecked here.
- XML remains the recorded preference for Champion-facing modules; “project knowledge files” remains the recorded term for files uploaded into project context.
- No live cart mutation, completed checkout, customer OAuth session or successful full storefront chat response has yet been verified.

## 10. NEXT ACTIONS

1. Remove the storefront password gate, then rerun `python ops/check_catalog.py --label <date>` and `python ops/check_discovery.py --label <date>`.
2. Deploy the current provider-router/quiz-fact maintenance changes, then test the complete widget → `/chat` → selected text provider → Shopify tools → widget response path. Treat `/chat?health=true` as reachability only.
3. Verify customer OAuth, cart handoff and database persistence in production, then run `shopify app deploy` to synchronize application and redirect configuration if it has not already been deployed.
4. Inspect intended baby products individually, including current status and sales-channel assignment; repeat relevant search and lookup checks after any approved changes.
5. Re-observe Knowledge Base gaps; make the operator's intended changes based on current state.
6. Record new evidence in `VERIFICATION_LOG.md`. Initial log creation and completed pushes do not need to be repeated as unresolved tasks.

**Evidence:** [verification log](VERIFICATION_LOG.md), [connection audit](../../shop-chat-agent-main/MCP-CONNECTION-AUDIT.md), [saved connection results](../../shop-chat-agent-main/connection-check.json), September 11 evidence files under `ops/evidence/`, application source, and local Git history/tracking ref. Historical admin observations are explicitly separated from newer live checks.
