# UX — what the copy may and may not claim

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/services/global-fulfillment.server.js`, `starter-intent.server.js`, `app/prompts/prompts.json`, both `.liquid` blocks, `tests/starter-intent.test.mjs`, `tests/widget-backend.test.mjs`.

This is the file to read before changing any customer-visible sentence.

## The evidence ladder

| Claim | Supported by | Status |
| --- | --- | --- |
| "This product is made by Printify" | `vendor` field from the store's own `/products.json` | **Supported** |
| "This product is Printify Choice eligible" | nothing connected | **Forbidden** |
| "We deliver to <country>" | nothing connected | **Forbidden** |
| "Printify confirms coverage at checkout" | describes where confirmation happens, promises no outcome | **Supported** |

A vendor label is catalog grouping. It is not routing, eligibility, or coverage. `catalog-priority.server.js` states this in its own `recommendation_policy.note`, which travels with the tool result to the model.

## The one message shown with products

> These Lazy Customs products are produced and shipped through the Printify print network. Open a product page to choose options and save any personalization. Printify confirms delivery coverage, times and cost for your address during checkout. A Printify vendor label does not by itself guarantee Printify Choice routing or delivery to every country.

An earlier draft added "which prints in facilities in several countries." It was cut — the claim could not be sourced from the corpus or a reachable primary source.

## Theme copy

Both blocks carry: *"See products made in the Printify global print network, or browse our whole Shopify store catalog."* Button labels are "Global fulfillment" and "Shopify".

## Enforced by test, not by discipline

Two suites assert the limits rather than the wording:

1. No Global fulfillment message may ask for a delivery country, or contain a guaranteed-worldwide-delivery or verified-eligibility phrase. This guard rejected the draft message above.
2. No theme asset — Liquid or JS — may contain `verified choice`, `guaranteed worldwide/global`, or `ships worldwide`.

Changing copy means re-running `npm test`; a promise slipped into a sentence fails the suite.

## Customer URL allowlist

`customerProductUrl` accepts an HTTPS product page on `lazycustoms.com`, `www.lazycustoms.com`, `vbw9zu-f7.myshopify.com`, or `lazy-customs-2.myshopify.com`, plus relative `/products/<handle>` paths. It canonicalizes all of them to `https://lazycustoms.com/products/<handle>` and strips query and fragment.

Rejected: non-HTTPS, credentials in the URL, foreign shops, admin or merchant paths, encoded-path tricks, anything not matching `/products/<handle>`. A card without an approved URL is dropped.

**Open:** the canonicalization assumes all three hosts serve identical product handles. That rests on `CURRENT_STATE.md` and `07-repo-audit.md`, not on a live check. See `TODO.md`.

## Model-facing policy

`prompts.json` → `shoppingPolicy` carries the same limits for free-form chat: never describe vendor metadata as verified Choice eligibility, say coverage is confirmed at checkout, do not ask for a delivery country, never promise exclusive fulfillment or guaranteed worldwide shipping.
