# Lazy Chat: evidence-backed Global Fulfillment

Updated September 14, 2026 UTC on `codex/printify-first`.

## Verified scope

The signed-in Printify product page for `6a7769c211b5d6d7cb0c60bd`
(Crewneck Sweatshirt — Abstract Brown Geometric Pattern, blueprint 49) showed
Global Fulfillment enabled. The product list showed Published and Printify Choice.
Its Global Fulfillment delivery table showed US 2–5, Canada 2–5, Australia 3–6,
and UK 2–3 business days. These are provider estimates, not arrival guarantees.

Source: https://printify.com/app/product-details/6a7769c211b5d6d7cb0c60bd?fromProductsPage=1

The public Printify product API independently returned provider 99, Shopify
product ID 10446334558530, six enabled variant IDs, and the mapped customer URL.
The source does not expose a documented Global Fulfillment eligibility flag.
The dashboard observation is therefore recorded as a short-lived, manually
reviewed server-side evidence record, not replaced by a vendor/provider test.

Only US, CA, and AU passed explicit live shipping-profile coverage for all
purchasable mapped variants. UK is excluded because the v1 API did not return
explicit GB coverage. EU is excluded pending store compliance confirmation.
No REST_OF_THE_WORLD inference is accepted.

## Runtime contract

Both widgets send `intent: global_fulfillment` or `intent: shopify_catalog` to
POST /chat. Global requests reach the server-only Printify boundary before any
AI or Shopify search_catalog call. Shopify requests retain their catalog path
and lazycustoms.com customer product links.

Global verification requires the server's PRINTIFY_API_TOKEN, an unexpired
Printify dashboard evidence record, an unchanged live Printify product identity,
provider, blueprint, updated_at and enabled variant set, an available mapped
Shopify product, and explicit API shipping coverage for every purchasable SKU.
Additional unmapped purchasable Shopify variants invalidate the result.

The first global request checks product availability and returns
`needs_destination` with country buttons. Selection posts the same intent plus
`destination: US`, `CA`, or `AU`. Successful responses say what was checked and
when. Purchase/personalization stays on:
https://lazycustoms.com/products/crewneck-sweatshirt-abstract-brown-geometric-pattern

No merchant dashboard URL, credential, or raw provider error is sent to shoppers.
No checkout, payment, order submission, or production operation was performed.

The evidence expires September 15, 2026 at 03:42 UTC (September 14, 11:42 PM EDT).
It is not renewed automatically. Re-observe the actual Printify Global Fulfillment
banner, product publication, eligible variant set and country delivery table
before updating the evidence record and deploying. Product changes, expiry,
missing credentials, unsupported countries and failed sources return unverified
with no Shopify fallback. A verified result means checked configuration and
coverage, not proof that a future order has been delivered.

## Configuration and tonight's completion steps

1. Set PRINTIFY_API_TOKEN in Railway project valiant-liberation, service
   02_IAMHUB, production Variables. Use the existing valid token from the local
   ignored .env; never put it in Shopify theme settings or public JavaScript.
2. Deploy the tested codex/printify-first commit to that Railway service.
3. Release the matching Shopify chat-bubble extension.
4. Check Global fulfillment, then United States, Canada and Australia. Each
   should return the one crewneck. Shopify should retain ordinary catalog
   results. GB and unknown country codes must return unverified, not a fallback.
5. Before the evidence expiry, repeat the Printify dashboard inspection and
   renew only facts still supported. To expand products, observe each product's
   Global Fulfillment confirmation and variants, then add matching server checks.

Printify's official setup instructions:
https://help.printify.com/hc/en-us/articles/33741445661457-How-can-I-create-a-product-with-Printify-Choice-Global-Fulfillment

## Validation

Local lint, 67 tests, typecheck, and production client/server build passed.
Tests cover distinct widget intents and country requests, POST source routing,
all-Printify vendor rejection, snapshot expiry, changed variants, missing country
coverage, provider failure, customer links, and credential isolation.
Live server-module checks: no destination -> needs_destination; US/CA/AU ->
verified with one product; GB -> unavailable with zero products.
The build reports existing nonfatal future-flag and bundling notices.

The read-only scripts/audit-printify-eligibility.mjs collects sanitized account
product evidence into ignored printify-eligibility-audit.json. Its initial
limit=100 request returned HTTP 400; the corrected limit=50 audit completed.
No secret values or order/customer data were emitted.
