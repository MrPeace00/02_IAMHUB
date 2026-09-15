# Glossary

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.

Terms are kept distinct because collapsing any two of them has previously produced a false claim.

| Term | Means | Does **not** mean |
| --- | --- | --- |
| **Starter** | One of the two shopping entry buttons, `global_fulfillment` or `shopify_catalog`. | A conversation mode. Intent is request-scoped and never inherited. |
| **Intent** | The `intent` field on a `POST /chat` body. Allowlisted; unknown values are rejected 400. | A guess from the message text. The server never infers it. |
| **Printify Choice** | An order-routing option applied when an order is submitted, so Printify selects a print provider. | A catalog, a storefront, a browsable product set, or a product attribute the app can currently read. |
| **Choice eligibility** | Whether a product can be routed through Printify Choice / Global Fulfillment. For the one product in the evidence record it is established by a live product+shipping check; for every other product it is still unestablished. | Anything the vendor label alone establishes. |
| **Vendor label** | The `vendor` field on a Shopify product, read from the store's own `/products.json`. | Proof of Choice routing, delivery coverage, or personalization support. |
| **Global fulfillment** | The starter that live-verifies one evidence-anchored Printify Choice product for an approved destination. | A catalog filter, or a promise of worldwide delivery. It is a gated verification, not a view of the catalog. |
| **Catalog** | The single Lazy Customs Shopify product catalog. | Two catalogs. Both starters read this one. |
| **UCP** | The commerce protocol whose manifest `lazycustoms.com/.well-known/ucp` advertises; catalog search runs against its MCP endpoint. | A payment licence or a security posture. |
| **MCP** | Model Context Protocol — how the app reaches storefront and customer tools. | The same thing as UCP. |
| **`search_catalog`** | The current catalog tool name on the UCP MCP endpoint. | `search_shop_catalog`, its pre-migration name (see `config.server.js`). |
| **Starter result** | The `starter_result` SSE event carrying `intent`, `state`, `message`, `products`, optional `reason`, and — on the global path — `destination`/`destinations`/`evidence_checked_at`. | A single fixed shape. `state` may be `catalog`, `unavailable`, `verified`, or `needs_destination`. |
| **Fulfillment record** | A telemetry row written through an explicit allowlist in `fulfillment-record.server.js`. | Evidence that an order was placed or shipped. |
| **Evidence record** | `global-fulfillment-evidence.server.js` — a human-observed, 24-hour-windowed anchor for the verified product (ids, variants, destinations). | A substitute for the live check. The code re-verifies against Printify every request regardless. |
