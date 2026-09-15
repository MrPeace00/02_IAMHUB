# UX — verified global fulfillment

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/services/global-fulfillment.server.js`, `app/services/global-fulfillment-evidence.server.js`, `scripts/audit-printify-eligibility.mjs`.

This is the mechanism behind a `verified` Global fulfillment result. It exists because a Printify vendor label proves only that Printify *makes* a product — not that it is Choice-routed or deliverable. This path establishes both, per product and per destination, with a live check every time.

## Two layers: anchor + live check

**Anchor — the evidence record.** A human observes one Printify product in the Printify app, confirms it shows "You're saving time and money with Global Fulfillment!" and the Global Fulfillment costs/delivery table, and records the immutable facts: `shop_id`, `product_id`, `blueprint_id`, `print_provider_id` (99), `updated_at`, `shopify_product_id`, `handle`, the enabled `variant_ids`, and the approved `destinations`. It is stamped `observed_at`/`expires_at` with a **24-hour** window and an explicit "re-observe before extending" note.

**Live check — every request.** The evidence is never trusted on its own. On each Global fulfillment request the code re-fetches the Printify product and the Shopify storefront product and compares them against the anchor field by field (see `20_UX_STARTER_FLOWS.md`, gates 4–7). If Printify's `updated_at` moved, a variant changed, the storefront went unavailable, or shipping coverage is missing for the chosen destination, the result degrades to `unavailable` with a specific reason. A stale or wrong anchor therefore **cannot** produce a false `verified` — the live check catches drift.

## Why the window matters operationally

When `expires_at` passes, gate 2 returns `evidence_expired` and the button goes dark until a human re-observes and extends. The 24-hour window is a deliberate forcing function: it guarantees no verified claim outlives a day-old human observation. Re-arming the timestamp on operator attestation is legitimate; the live check remains the real backstop.

## Approved destinations

US, CA, AU, each with a delivery estimate in the evidence record. The record's own `exclusions` note explains the omissions: UK excluded because live v1 shipping profiles lack explicit GB coverage; EU excluded pending store compliance confirmation. An unlisted destination returns `destination_unverified` and says ordinary store orders may still ship there — it does not claim they cannot.

## Refreshing / re-auditing the evidence

- **Extend the window** (product unchanged): update `observed_at`/`expires_at` after a human re-observes the Printify product. On 2026-09-15 the window was re-armed on operator attestation.
- **Re-audit the identifiers** (product may have changed): run `node scripts/audit-printify-eligibility.mjs` from a network that reaches `api.printify.com`, with `PRINTIFY_API_TOKEN` in `.env`. It is read-only, never emits the token or order/customer data, and writes `printify-eligibility-audit.json` listing each product's blueprint, provider, visibility, external mapping, `updated_at`, enabled variant ids, and any `choice/global/eligible` fields — the raw material for updating the record.

## Claim discipline on the verified card

Even at `verified`, the message calls the delivery time an **estimate, not a guaranteed arrival date**, and says checkout confirms the final shipping charge and availability. It states when the human observation happened and that variants and coverage were rechecked live. This keeps the strongest claim the system makes inside Engine §11.
