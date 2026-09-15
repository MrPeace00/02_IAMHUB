# Shopify frontend — catalog, MCP and UCP

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/mcp-client.js`, `app/services/catalog-priority.server.js`, `config.server.js`, `_lazycustoms/docs/01-ucp-implementation-log.md`.

## Where products come from

Catalog search runs over MCP against the store's UCP endpoint. `AppConfig.tools.productSearchName` is `search_catalog`; the pre-migration name `search_shop_catalog` is retained only as a comment in `config.server.js`.

Per the project record, tool routing is: catalog → `/api/ucp/mcp`, standard cart → `/api/mcp` with a UCP fallback, policy → `/api/mcp`.

`lazycustoms.com/.well-known/ucp` advertises shopping, catalog, cart, checkout and order capabilities, backed by `https://vbw9zu-f7.myshopify.com/api/ucp/mcp`. **Advertised handlers do not establish a tested payment flow** — that is the project record's own wording and it is the correct rung.

## Vendor enrichment

The catalog tool's results do not carry a reliable vendor. `catalog-priority.server.js` fills it from the store's **own public product feed**:

```
GET <origin>/products.json?limit=250&page=<n>     max 4 pages, 5s timeout
```

- Only the four allowlisted store origins are fetched; anything else returns an empty index immediately.
- Results are cached per origin for 60 seconds.
- Product identity is matched on the numeric id, stripping any `gid://shopify/Product/` prefix — **never on title**.
- On any failure the index is empty and products keep their original order.

That last point matters: an empty index is indistinguishable from "no vendors" unless the caller checks. `global-fulfillment.server.js` does check, and reports `vendor_metadata_unavailable` separately.

## Provider preference

`provider_preference` is applied **locally**, never added to the search text:

| Value | Effect |
| --- | --- |
| `printify` | Stable sort: Printify-vendor first, then other vendors, then unavailable products last. |
| `any` | No reordering. Both starters use this. |
| `exclude_printify` | Filters out products whose vendor matches Printify. |

`requestedProviderPreference` detects an explicit refusal ("not Printify", "another provider") and switches to `exclude_printify`.

`catalogArgsForRequest` forces an empty catalog query for a category-free browse such as "what do you have", so the full catalog returns. The server enforces this regardless of what the model sends.

## Availability

A product counts as available when `availability.available !== false` and, if it has variants, at least one variant is likewise not marked unavailable. Unavailable products sort last under the `printify` preference; they are not removed.
