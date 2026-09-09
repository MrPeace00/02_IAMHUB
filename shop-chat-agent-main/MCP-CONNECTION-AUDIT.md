# MCP connection audit — September 8, 2026

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
