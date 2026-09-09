# MCP connection audit — September 8, 2026

## Follow-up: catalog and published widget

Checked September 9, 2026 at 01:39 UTC (September 8 local time). See connection-check.json for the compact live evidence.

- The public storefront is reachable and serves published products. Its actual rendered window.shopChatConfig.appUrl still points to plate-proprietary-bottles-cruz.trycloudflare.com. Both this live setting and the matching shopify.app.toml URL fail DNS resolution (ENOTFOUND).
- UCP searches without added context return 10 products for "shirt", 10 for "hoodie", and 10 for an empty browse query; "baby" returns zero, with status success and no diagnostic messages. Adding US context gives the same counts. The evidence supports a query-specific empty result, not a store-wide catalog outage. It does not prove whether a particular baby product should have been indexed.
- Removed the expired tunnel default from the theme block and the localhost fallback from the widget. Added HTTPS-origin validation and a bounded availability check before enabling chat. The widget shows a temporary-unavailability message if the check fails.
- Added GET /chat?health=true with CORS and no-store headers. This identifies the backend without accessing the database, customer accounts or Claude. It is a reachability check, not an AI/database readiness guarantee. Deploy the backend health route before the updated widget.
- Added scripts/check-connections.mjs: read-only checks of configured and published backend URLs plus four catalog queries. Run `node scripts/check-connections.mjs`; exit code 1 means a backend check or catalog request failed, while a successful zero-match search is not itself a failure.
- Eight regression tests pass. The live connection-check script correctly exits 1 because the published tunnel is expired.

**Deployment remains pending:** a new running public backend origin must replace the old application_url, auth redirect URLs and active theme block setting. No replacement origin was available during this follow-up; no URL was invented, and no live configuration was changed. Removing a schema default does not overwrite the existing merchant setting.

## Verified local and live findings

Claude's supplied audit predates the working tree: mcp-client.js and config.server.js already contained uncommitted UCP migration edits. Those edits were preserved and repaired.

The Liquid block supplies appUrl to chat.js, which posts SSE requests to /chat. The chat route discovers Shopify tools, passes their schemas to Claude, and dispatches calls through MCPClient. This is agent-to-Shopify tool communication, not a separate agent-to-agent messaging protocol.

Live tools/list requests returned HTTP 200 on both lazy-customs-2.myshopify.com and lazycustoms.com. The repaired client itself was exercised against both domains with auth/database imports isolated; real fetch and the actual discovery/call code were used.

| Tools | Actual endpoint on both domains |
|---|---|
| search_shop_policies_and_faqs | /api/mcp |
| search_catalog, lookup_catalog, get_product | /api/ucp/mcp |
| get_cart, create_cart, update_cart | /api/ucp/mcp |

The live standard endpoint does **not** advertise get_cart or update_cart. Keep standard cart routing when a store advertises it, otherwise use the discovered UCP cart schema and endpoint. No checkout/payment tools are exposed by this change.

Policy lookup returned a successful answer stating customers must contact the merchant to request a return. It did not supply a complete shipping policy. The repaired client successfully called search_catalog with query "baby" on both domains: UCP status success, isError false, zero products. This does not establish why products are absent or that every search will be empty.

## Repairs

- Agent profile placed at params.arguments.meta.ucp-agent.profile for UCP discovery and calls, matching Shopify's current examples. Existing UCP_AGENT_PROFILE_URL override retained; default example updated to 2026-08-25.
- Catalog routes remain UCP; cart routes prefer standard MCP, with discovered UCP fallback; policy lookup remains standard MCP.
- Reconnects replace tool lists; unknown storefront tools cannot silently fall back to the wrong endpoint. Endpoint discovery failures are isolated.
- JSON-RPC failures surface as errors. MCP isError results are marked as errors in model history, and structured results are retained.
- UCP product cards accept structured content, current product IDs/media and currency minor units.
- Every assistant prompt shares tool-backed policy and cart rules. This aligns agent behavior with returned merchant policies; it does not edit Shopify policies or enforce new checkout rules.
- A failed customer endpoint discovery no longer causes null destructuring to abort storefront chat initialization.

## Validation and limits

Four Node regression tests pass (routing/profile placement, live-shaped UCP cart fallback, RPC failure isolation, structured products/error history). Targeted ESLint passes for the changed client, chat route, Claude service and tool service.

Run tests with: `node --preserve-symlinks --preserve-symlinks-main --test tests/mcp-routing.test.mjs`.

No live cart was created or changed, no checkout was completed, and customer OAuth was not exercised. Full browser-to-Claude chat and production deployment were not verified. The theme block still has a temporary trycloudflare.com default backend URL; its active merchant setting must point to a running backend. Local repairs do not update deployed code.

The default UCP profile is Shopify's public example, not a Lazy Customs-owned profile. Production can supply its hosted profile through UCP_AGENT_PROFILE_URL.

Sources checked: https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront and https://shopify.dev/docs/agents/catalog/storefront-catalog . Live discovery takes precedence over the older standard-cart endpoint example for this store.
