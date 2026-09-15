# UX — the two starter flows

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/routes/chat.jsx`, `app/services/starter-intent.server.js`, `app/services/global-fulfillment.server.js`, `app/services/global-fulfillment-evidence.server.js`.

## The fact that shapes everything

**Lazy Customs has one Shopify catalog.** Both starters read it. They differ on three axes, in this order: **code path**, **products kept**, and **what each may claim**. A deterministic server dispatcher runs before any AI or account discovery, so the difference no longer depends on what the model does with a prompt sentence.

## Dispatch order

```
POST /chat
  -> reject non-object body or unknown intent            400
  -> reject non-string / blank message                   400
  -> dispatchStarter({ intent, destination, ... })
       intent undefined -> null -> existing general chat flow
       'shopify_catalog'   -> whole catalog, any provider
       'global_fulfillment'-> verified-fulfillment gate (below)
```

`destination` rides the same request body and is only consumed by the global path.

## Shopify starter

Whole catalog, provider preference `any`, no fulfillment claim. Each product URL passes `customerProductUrl`; cards without an approved URL are dropped. Outcomes: `catalog` with products, `catalog` with an empty list and a "no approved customer pages" message, or `unavailable`/`catalog_unavailable` on a read error.

## Global fulfillment starter — the verification chain

This is not a catalog filter. It is a gated, evidence-backed verification of **one** confirmed Printify Choice product, re-checked live on every request. `createGlobalFulfillment()` runs these gates in order and returns `unavailable` at the first failure:

1. **Config.** No `PRINTIFY_API_TOKEN` or no evidence record → `eligibility_source_not_configured`.
2. **Evidence freshness.** Evidence `expires_at` in the past, or `observed_at` in the future → `evidence_expired`.
3. **Destination allowlist.** A supplied `destination` not in the evidence record → `destination_unverified` (message names US, CA, AU).
4. **Live product match.** GET the Printify product; every one of these must still match the evidence: `product_id`, `blueprint_id`, `print_provider_id`, `updated_at`, `visible`, `external.id` = the Shopify product id, and the enabled variant id set. Any drift → `product_evidence_changed`.
5. **Live storefront match.** GET `https://lazycustoms.com/products/<handle>.js`; the Shopify id must match and the product must be `available` → else `customer_product_unavailable`. At least one enabled Printify variant must map by SKU to an available storefront variant → else `customer_variants_unavailable`. A storefront variant available but not in the verified set → `customer_variants_changed`.
6. **Destination question.** If no `destination` was supplied and everything above passed → `needs_destination`, returning the allowed `{code,label}` list. **This is the one place the flow asks for a delivery country — and only after live verification, only for the pre-approved destinations.**
7. **Live shipping coverage.** GET the blueprint/print-provider shipping profiles; every verified variant must be covered for the chosen destination → else `destination_coverage_unverified`.
8. **Verified.** Returns `state: 'verified'`, the destination, `evidence_checked_at`, and one product card with a delivery estimate.

Any thrown error in the chain → `provider_unavailable`. No branch falls back to the unfiltered catalog, and no raw provider error text reaches the client.

## States this starter can emit

`verified` · `needs_destination` · `unavailable` (with `reason` one of: `eligibility_source_not_configured`, `evidence_expired`, `destination_unverified`, `product_evidence_changed`, `customer_product_unavailable`, `customer_variants_unavailable`, `customer_variants_changed`, `destination_coverage_unverified`, `provider_unavailable`).

## Intent and destination are request-scoped

The server never infers intent or destination from message wording, history, or `prompt_type`. A follow-up omits both and returns to general chat. The destination buttons in the widget re-issue an explicit `global_fulfillment` request carrying the chosen country code.

## The evidence record is human-anchored

`global-fulfillment-evidence.server.js` is a human-observed confirmation: shop id, product id, blueprint, print provider (99 = Printify Choice), the Shopify product id and handle, the verified variant ids, and the approved destinations (US/CA/AU) with delivery estimates. It carries `observed_at`/`expires_at` (a 24-hour window) and a note that it must be re-observed before extending. See `24_UX_VERIFIED_FULFILLMENT.md`.
