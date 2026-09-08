# CATALOG_ELIGIBILITY — Verified Gate List

**Source:** help.shopify.com/en/manual/shopify-catalog/requirements and help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/*
**Checked:** 2026-09-02
**Re-check before relying on this file.** These rules change.

Nothing in `GEO_PLAYBOOK.md` or `PRODUCT_DATA_SPEC.md` produces any result until every gate below is passed. Catalog eligibility is a **prerequisite**, not a parallel track.

---

## Store-level gates

| # | Gate | Evidence | LC status |
|---|---|---|---|
| S1 | Complies with Shopify Terms of Service and Acceptable Use Policy | Verified | Assumed pass |
| S2 | On Starter plan or higher | Verified | Unverified |
| S3 | **Store not in private mode** | Verified | **PASS (2026-09-08) — password protection and B2B restriction disabled; see D10, D11** |
| S4 | Terms of service, Privacy policy, Return and refund policy completed in Settings > Policies | Verified | Unverified |
| S5 | Account standing: verified email, two-step auth, identity/business verification when prompted | Verified | Unverified |
| S6 | Operating history: genuine sales to real customers, prompt fulfillment, low chargeback rate, invoices paid on time | Verified | **Unknown — no public operating history** |

**On S5/S6:** Shopify states eligibility is reviewed over time and that a store may *lose* eligibility if it stops meeting requirements. **[Verified]** This is not a one-time checkbox. It is an ongoing condition.

---

## Product-level gates

| # | Gate | Evidence | LC status |
|---|---|---|---|
| P1 | Title present | Verified | Per-product check |
| P2 | At least 1 product image | Verified | Per-product check |
| P3 | Price greater than zero — free products excluded | Verified | Per-product check |
| P4 | Published to Online Store, Hydrogen, or Headless channel | Verified | **Feed live with 30 products (2026-09-08, `check_catalog.py` baseline, D11) — not a zero-product blocker. Known Draft ×4, plus any 0-channel Active products, are excluded from that 30 and still need per-product audit.** |
| P5 | Identifiable product URL | Verified | Per-product check |
| P6 | Not Unlisted status, not hidden from search engines | Verified | Per-product check |
| P7 | No sensitive/mature content | Verified | Assumed pass |

---

## Automatic exclusions to be aware of

Shopify's agentic storefronts support **direct-to-consumer only**. Products are automatically excluded when Shopify can identify them as B2B-only via: B2B catalogs, customer-account requirements, or storefronts in private mode. **[Verified]**

If you sell the same product B2B and D2C, the **D2C price** is what appears. B2B pricing does not display on agentic storefronts. **[Verified]**

---

## Per-product audit worksheet

Copy one block per product. Do not mark a row without opening the product and looking.

```
PRODUCT: ____________________
[ ] P1 Title present and specific
[ ] P2 ≥1 image
[ ] P3 Price > 0
[ ] P4 Published to Online Store
[ ] P5 Product URL resolves
[ ] P6 Not Unlisted / not hidden from search engines
[ ] P7 No sensitive content
[ ] Category assigned (Shopify taxonomy)
[ ] Core metafields populated per PRODUCT_DATA_SPEC.md
[ ] Description written as an answer, not a feature list
Date audited: __________
```

Known products requiring audit: ~~Plush Crib Mobile · Baby Sleep Sack · Nursery Wall Art Plaque · Cotton Baby Bibs~~ — **correction (2026-09-08):** these 4, plus a 5th (Family Name Coaster Set), are abandoned manual scaffolds, not the live catalog. Confirmed by direct inspection: vendor still set to Shopify's placeholder "Your Brand", no image uploaded, no sales, category unconfirmed. The real, live catalog is apparel + candle/fragrance products bulk-imported via a POD integration (vendor "ODMPOD"), with real photos and inventory. These 5 Drafts are out of scope for the §9.2 / D12 34-product feed-gap audit — that audit should target the **Active apparel/candle products only**. See D13 in `00-decision-log.md`.

Products requiring audit for §9.2: all Active apparel/candle/fragrance products not appearing in `/products.json` (the 34-product gap identified in D12).

---

## Hiding a product deliberately

If a product must be invisible to AI channels, set status to **Unlisted**. **[Verified]**

**Caution:** Unlisted also hides the product from sitemaps, from search engines, and from your own online store search. **[Verified]** It is a blunt instrument.

Blocking AI crawlers at `robots.txt` or the network layer affects **only open-web discoverability**. It does not stop Shopify Catalog from sending product data to activated agentic storefronts. **[Verified]** These are two independent channels.
