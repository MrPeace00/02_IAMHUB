# LAZY CUSTOMS — CURRENT STATE

**Project:** lazycustoms.com — Shopify print-on-demand store with a baby-goods focus and a customer-facing AI chat agent under development  
**Operator:** Mr. Peace Elluvasun Allah Cush-El  
**Store handle used in project:** `lazy-customs-2`  
**Published UCP backing hostname:** `vbw9zu-f7.myshopify.com`  
**Updated through:** September 8, 2026 local time; connection evidence timestamp September 9, 2026, 01:39 UTC  
**Governed by:** LAZY CUSTOMS — STORE AND AGENT ENGINE v2.0 · CHAMPION MASTER ENGINE v5.5

## 1. CURRENT POSITION

UCP is published and catalog search works. The chat-agent fork is implemented and tested locally, and its three completed commits are pushed. The published storefront widget still points to an expired backend tunnel, so a working customer chat session has not been verified.

Two outcomes remain distinct:

1. **Machine discovery and transactions:** the store publishes UCP capabilities for external agents. Publication and catalog responses are verified; third-party agent visibility and completed transactions are not.
2. **Customer-facing chat:** the fork provides the storefront widget, chat orchestration, Claude streaming and Shopify MCP client. Deployment and end-to-end operation remain pending.

Catalog/product decisions and chat deployment can proceed independently. A successful API connection does not prove that every intended product is indexed or that a deployed chatbot works.

## 2. REPOSITORY STRUCTURE

Repository root: `C:\Users\P\Desktop\02_IAMHUB`.

| Location | Contents |
|---|---|
| `shop-chat-agent-main/` | Active application fork: React Router v7, Shopify OAuth, Prisma, theme extension and Anthropic streaming |
| `_lazycustoms/` | Planning documents, operations scripts and staged additions within the same repository |

**Constraint:** these folders remain siblings. `_lazycustoms` is not nested inside the application.

Key application files:

- `app/mcp-client.js` — discovers tools and routes calls, including UCP agent-profile metadata.
- `app/routes/chat.jsx` — chat route and `GET /chat?health=true` reachability check.
- `app/services/claude.server.js` — shared tool-backed policy and cart instructions across assistant modes.
- `app/services/tool.server.js` — tool results, errors and UCP product-card formatting.
- `extensions/chat-bubble/assets/chat.js` — HTTPS backend validation and bounded health check before enabling chat.
- `extensions/chat-bubble/blocks/chat-interface.liquid` — merchant backend setting; expired default removed from source.
- `scripts/check-connections.mjs` — read-only published/configured backend and catalog diagnostics.
- `tests/mcp-routing.test.mjs` and `tests/widget-backend.test.mjs` — eight regression tests.
- `connection-check.json` and `MCP-CONNECTION-AUDIT.md` — saved live evidence and audit details.

Verification record: [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md).

## 3. COMMIT RECORD — PUSHED

The operator confirmed successful fetch/push against GitHub. Local `HEAD` and the local `origin/main` tracking ref both resolve to `51fb5b7`. The working tree was clean before this report update. This new report is a subsequent documentation change, not part of those three commits.

| Commit | Completed work |
|---|---|
| `99c2c3a` | Corrected UCP metadata and tool routing; added cart fallback, result handling, shared policy instructions and routing tests |
| `180de63` | Removed stale widget defaults, added backend health checks and widget tests, and recorded connection evidence |
| `51fb5b7` | Added `VERIFICATION_LOG.md` with five dated entries |

Pushing code does not deploy the application or update an existing merchant theme setting.

## 4. VALIDATION AND LIVE FINDINGS

### Code checks

| Check | Recorded result |
|---|---|
| MCP routing regression tests | 4 passed |
| Widget/backend regression tests | 4 passed |
| Targeted ESLint | Passed |
| Backend/Claude/customer OAuth/browser integration | Not verified end to end |

### Catalog queries

Saved check: September 9, 2026, 01:39 UTC, against `lazycustoms.com`.

| Query | Products returned | Result |
|---|---|---|
| `shirt` | 10 | Success |
| `hoodie` | 10 | Success; another page available |
| Empty browse query | 10 | Success; another page available |
| `baby` | 0 | Success; no diagnostic messages |

The zero-match `baby` result is not evidence of an API outage, a store-wide empty catalog, or the absence of baby tags. Why any particular intended baby product is missing remains unestablished. Product-level status, channel assignment and indexing need inspection before assigning a cause.

### Published widget

The rendered storefront `window.shopChatConfig.appUrl` and `shopify.app.toml` point to `https://plate-proprietary-bottles-cruz.trycloudflare.com`. The saved check records DNS failure `ENOTFOUND` for both.

Removing the default from source does not replace that existing published merchant setting. The new health route checks backend identity and reachability only; it does not prove database, Claude or OAuth readiness.

## 5. COMMERCE MECHANISMS AND ACTUAL ROUTES

| Mechanism | Verified status and scope |
|---|---|
| UCP publication | `https://lazycustoms.com/.well-known/ucp` returns HTTP 200 with cart, checkout, order, catalog search/lookup and Shopify catalog capabilities |
| Storefront MCP | Implemented in the fork as a client of Shopify-hosted servers; policy discovery and lookup were successfully exercised |
| Catalog over UCP MCP | Search, lookup and product-detail tools are advertised; catalog search returns products |
| Cloud: Claude AI Assistant | Previously reported installed for merchant back-office work; not rechecked in this update and not the storefront chatbot |

Both `lazycustoms.com` and `lazy-customs-2.myshopify.com` publish the same UCP backing endpoint: `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`. The manifest advertises Google Pay, Shopify Card and Shop Pay handlers. Advertised handlers do not establish a tested payment flow.

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
| UI reportedly said Agentic Storefronts were not live | Do not generalize to present platform status; this store's UCP publication is now verified |
| Admin catalog feed showed 0 products | Historical observation; current UCP searches return products. Admin feed status still needs reinspection |
| Knowledge Base: 5 FAQs, 7 unanswered topics, 0 agent queries | Current counts not rechecked |
| Customer-facing agent described as Concept/nonexistent | Superseded: fork implemented and tested; working deployment remains unverified |
| UCP publication unconfirmed | Superseded: HTTP 200 manifest verified |
| Unsaved Preferences password toggle | Current editor state unknown. Public homepage was reachable without a password during follow-up |

## 7. OPEN ITEMS REGISTER

Original item numbers are retained for continuity.

| # | Item | Current status / next action |
|---|---|---|
| 1 | Four previously Draft products: Plush Crib Mobile, Baby Sleep Sack, Nursery Wall Art Plaque, Cotton Baby Bibs | Recheck status; operator decides publish versus keep Draft. Not a proven cause of zero `baby` matches |
| 2 | Previously Active products assigned to zero channels | Recheck assignments and intended channel strategy; inspect specific missing products |
| 3 | Seven previously unanswered Knowledge Base topics | Recheck current gaps and approve merchant answers; do not invent policies |
| 4 | Pending Preferences password toggle | Re-observe current settings/editor state before save or discard; historical state may be stale |
| 5 | Agent runtime setup | Scaffolding is complete. Verify runtime credentials, database, customer OAuth and a full widget-to-Claude session in the deployment environment; credential availability was not inspected |
| 6 | UCP publication | **Resolved:** manifest verified live, including the shared backing MCP hostname |
| 7 | Verification log | **Resolved:** file exists and is committed in `51fb5b7` |
| 8 | Expired backend tunnel | **Open deployment blocker:** supply or provision a running public HTTPS backend, update app/auth URLs and active theme setting, then deploy and test |
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
- Runtime prompt keys are `standardAssistant`, `systemShopping`, `systemDesignCoach` and `enthusiasticAssistant`. A standalone `guardrails` prompt key is not present; shared commerce instructions are supplied by the Claude service.
- `.env` exists. Its contents and usable credentials were not inspected for this report; file existence is not proof of runtime readiness.
- Printify public API availability was previously reported verified; Tapstitch API availability remains an open vendor question. Neither was rechecked here.
- XML remains the recorded preference for Champion-facing modules; “project knowledge files” remains the recorded term for files uploaded into project context.
- No live cart mutation, completed checkout, customer OAuth session or successful full storefront chat was verified in this work.

## 10. NEXT ACTIONS

1. Resolve #8: obtain a running public backend origin, update `shopify.app.toml` application/auth redirects and the active theme block URL. Deploy the health route before the updated widget.
2. Verify runtime configuration and dependencies, then test the complete widget → `/chat` → Claude → Shopify tools → widget response path. Treat `/chat?health=true` as reachability only.
3. Inspect intended baby products individually, including current status and sales-channel assignment; repeat relevant search and lookup checks after any approved changes.
4. Re-observe the Preferences toggle and Knowledge Base gaps; make the operator's intended changes based on current state.
5. Record new evidence in `VERIFICATION_LOG.md`. UCP publication, initial log creation and the three completed pushes do not need to be repeated as unresolved tasks.

**Evidence:** [verification log](VERIFICATION_LOG.md), [connection audit](../../shop-chat-agent-main/MCP-CONNECTION-AUDIT.md), [saved connection results](../../shop-chat-agent-main/connection-check.json), application source, local Git history/tracking ref, and the operator's successful remote fetch/push confirmation. Historical admin observations are explicitly separated from newer live checks; this report update did not rerun those admin checks.
