# VERIFICATION_LOG — Lazy Customs

**Purpose:** Dated record of claims independently verified against live systems, satisfying Engine §5.1.5 compliance (Open Item #7).

**Rule:** Every entry records date, claim, method, evidence, and result. Add new rows; do not edit history.

---

| Date (UTC) | Claim | Method | Evidence | Result |
|---|---|---|---|---|
| 2026-09-08 | `mcp-client.js` UCP tool routing (catalog → `/api/ucp/mcp`, standard cart → `/api/mcp` with UCP fallback, policy → `/api/mcp`) is correct | Live `tools/list` against `lazy-customs-2.myshopify.com` and `lazycustoms.com`; `node --test tests/mcp-routing.test.mjs` | HTTP 200 on both domains; 4/4 tests pass; see `shop-chat-agent-main/MCP-CONNECTION-AUDIT.md` | Verified |
| 2026-09-08 | Live UCP catalog search for "baby" returns zero products; not an API/store-wide failure | Live `search_catalog` calls for "baby", "shirt", "hoodie", empty query on `lazycustoms.com` | `shop-chat-agent-main/connection-check.json`: "shirt"=10, "hoodie"=10, ""=10, "baby"=0, all `status: success`, `isError: false` | Verified (query-specific, root cause of missing baby products not established) |
| 2026-09-08 | Published widget backend (theme block `app_url` default) and `shopify.app.toml` application_url are dead | Direct DNS/HTTPS check of `plate-proprietary-bottles-cruz.trycloudflare.com` via `scripts/check-connections.mjs` | `connection-check.json`: `configuredBackendCheck.reachable: false`, `error: "ENOTFOUND"`; same for `publishedBackendCheck` | Verified — deployment blocker (Open Item #8) |
| 2026-09-08 | UCP is published and live for lazycustoms.com (previously logged as "unconfirmed") | `GET https://lazycustoms.com/.well-known/ucp` | HTTP 200; manifest lists `dev.ucp.shopping.{cart,checkout,order,catalog.search,catalog.lookup}`, `dev.shopify.catalog`, payment handlers (Google Pay, Shopify Card, Shop Pay); backing endpoint `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`; protocol version `2026-08-25` | Verified — supersedes Open Item #6 "unconfirmed" status; corrected in `_lazycustoms/docs/00-decision-log.md` and repo memory |
| 2026-09-08 | Widget backend hardening (HTTPS-origin validation, bounded availability check, `/chat?health=true`) works as designed | `node --test tests/mcp-routing.test.mjs tests/widget-backend.test.mjs` | 8/8 tests pass | Verified |
