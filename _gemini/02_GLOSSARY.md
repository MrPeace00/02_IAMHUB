# Glossary

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.

Terms are kept distinct because collapsing any two of them has previously produced a false claim.

| Term | Means | Does **not** mean |
| --- | --- | --- |
| **Starter** | One of the two shopping entry buttons, `global_fulfillment` or `shopify_catalog`. | A conversation mode. Intent is request-scoped and never inherited. |
| **Intent** | The `intent` field on a `POST /chat` body. Allowlisted; unknown values are rejected 400. | A guess from the message text. The server never infers it. |
| **Printify Choice** | An order-routing option applied when an order is submitted, so Printify selects a print provider. | A catalog, a storefront, a browsable product set, or a product attribute the app can currently read. |
| **Choice eligibility** | Whether a given product can be routed through Printify Choice. | Anything the vendor label establishes. No connected source provides it. |
| **Vendor label** | The `vendor` field on a Shopify product, read from the store's own `/products.json`. | Proof of Choice routing, delivery coverage, or personalization support. |
| **Global fulfillment** | The starter that filters the catalog to Printify-made products. | A promise of worldwide delivery. |
| **Catalog** | The single Lazy Customs Shopify product catalog. | Two catalogs. Both starters read this one. |
| **UCP** | The commerce protocol whose manifest `lazycustoms.com/.well-known/ucp` advertises; catalog search runs against its MCP endpoint. | A payment licence or a security posture. |
| **MCP** | Model Context Protocol — how the app reaches storefront and customer tools. | The same thing as UCP. |
| **`search_catalog`** | The current catalog tool name on the UCP MCP endpoint. | `search_shop_catalog`, its pre-migration name (see `config.server.js`). |
| **Starter result** | The `starter_result` SSE event carrying `intent`, `state`, `message`, `products`, optional `reason`, and `fulfillment` on the global success path. | A verified result. No branch emits a `verified` state. |
| **Fulfillment record** | A telemetry row written through an explicit allowlist in `fulfillment-record.server.js`. | Evidence that an order was placed or shipped. |
