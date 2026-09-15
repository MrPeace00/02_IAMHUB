# UX — what the copy may and may not claim

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/services/global-fulfillment.server.js`, `global-fulfillment-evidence.server.js`, `starter-intent.server.js`, `app/prompts/prompts.json`, the two `.liquid` blocks, and the test suites.

The file to read before changing any customer-visible sentence.

## The evidence ladder (as of main)

| Claim | Supported by | Status |
| --- | --- | --- |
| "This product is made by Printify" | `vendor` field from the store's `/products.json` | **Supported** |
| "This product is Printify Choice — Global Fulfillment" | the evidence record **plus** a live product/variant match at request time | **Supported for the one verified product** |
| "Verified for delivery to US / CA / AU" | live shipping-profile coverage check for that destination | **Supported per destination, per request** |
| "Delivery in N business days" | evidence record's estimate | **Supported only as an estimate**, never a guarantee |
| "Choice eligible" for any other product | nothing | **Forbidden** |
| "We deliver to <any other country>" | nothing | **Forbidden** — return `destination_unverified` |
| "Guaranteed worldwide delivery" | nothing | **Forbidden** |

The shift from the pre-verification state: a specific, live-checked product/destination pair may now be called verified. Everything outside that one product and those three destinations is exactly as unclaimable as before.

## The delivery-country question is now legitimate — narrowly

Earlier copy said the flow never asks for a country. That is no longer true, and must not be re-added as a blanket rule. The `needs_destination` state **does** ask — but only after live product verification has passed, and only offering the pre-approved US/CA/AU. Asking for an arbitrary country up front is still forbidden, because an unverified destination can only return `destination_unverified`.

## Theme copy

Both blocks carry: *"See products made in the Printify global print network, or browse our whole Shopify store catalog."* Buttons: "Global fulfillment" and "Shopify".

## Enforced by test, not discipline

The suites assert limits rather than wording: no Global fulfillment message may promise guaranteed worldwide delivery or verified-eligibility language it cannot back, and no theme asset may contain `verified choice`, `guaranteed worldwide/global`, or `ships worldwide`. Changing copy means re-running `npm test`.

## Customer URL allowlist

`customerProductUrl` accepts an HTTPS product page on `lazycustoms.com`, `www.lazycustoms.com`, `vbw9zu-f7.myshopify.com`, or `lazy-customs-2.myshopify.com`, plus relative `/products/<handle>`, canonicalizing all to `https://lazycustoms.com/products/<handle>` and stripping query/fragment. Rejected: non-HTTPS, credentials, foreign shops, admin/merchant paths, encoded-path tricks. A card without an approved URL is dropped. The verified path builds its URL directly from the evidence `handle`.

## Model-facing policy

`prompts.json` → `shoppingPolicy` carries the matching limits for free-form chat: never call vendor metadata verified Choice eligibility, say coverage is confirmed at checkout, never promise exclusive fulfillment or guaranteed worldwide shipping.
