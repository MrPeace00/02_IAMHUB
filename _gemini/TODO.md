# Lazy Chat — open work

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Ordered by what unblocks the most. Every item names what closes it.

## Operational — keep the button lit

- [ ] **Keep the Global fulfillment evidence fresh.** `global-fulfillment-evidence.server.js` has a 24-hour window; when `expires_at` passes, every request returns `evidence_expired` and the button goes dark. Re-observe the Printify product and extend the window. *Last re-armed:* 2026-09-15T04:53Z (on operator attestation). *Closes when:* a recurring re-observation cadence exists rather than a manual bump.
- [ ] **Re-audit identifiers periodically.** Run `node scripts/audit-printify-eligibility.mjs` (read-only, `PRINTIFY_API_TOKEN` in `.env`) to confirm the product's `updated_at`, variants, and external mapping still match the record. If Printify changed the product, the live check already fails closed with `product_evidence_changed` — this just tells you *before* a customer hits it.

## Expand coverage (each needs its own evidence)

- [ ] **Add destinations beyond US/CA/AU.** The record excludes UK (v1 shipping profiles lack explicit GB coverage) and EU (pending store compliance). *Closes when:* live shipping profiles confirm coverage and compliance is settled, then the destination is added to the record.
- [ ] **Verify more than one product.** The gate currently anchors a single crewneck. *Closes when:* the evidence model is generalized to a set and each product is human-observed + live-checked.

## Small, unblocked

- [ ] **Restore server-side logging in the `POST /chat` catch block.** Genericizing the client body was right; dropping `console.error` removed the only 500 diagnostic.
- [ ] **Handle a missing `Origin` header explicitly** in the Shopify starter — it currently throws to the catch and looks like a provider outage to any non-browser probe.
- [ ] **Fix the unused `welcome_message` widget setting** (schema defines it; inline config hard-codes "Heyyy").
- [ ] **Reconsider `maximum-scale=1.0, user-scalable=no`** in `chat-interface.liquid` — it disables pinch-zoom page-wide.
- [ ] **Confirm the store-alias assumption** behind `customerProductUrl` canonicalization with one `curl -I` per alias.

## Branch / deploy

- [ ] **Decide branch `claude/sharp-franklin-4q9u8d`.** It now equals `main` plus the `_gemini` corpus. PR #1 was closed unmerged; PR #2 (the verified work) is already merged to `main`. *Closes when:* the corpus is merged or the branch is retired.
- [ ] **Deploy the refreshed evidence.** The re-armed window only helps once `main`'s current `global-fulfillment-evidence.server.js` is live on Railway. *Closes when:* deployed and recorded in `VERIFICATION_LOG.md`.
- [ ] **Live-verify both starters in a browser** after deploy, including a real `needs_destination` → `verified` round-trip.

## Resolved / not needed

- [x] **Printify token rotation — NOT needed.** Per D-113 the token was generated 2026-09-12 with custom scope, placed directly in Railway, NR-4 observed; never pasted to chat, committed, or in browser code. Operator determination; no rotation.

## Hygiene

- [ ] Regenerate `_gemini/*.md` whenever the repository moves. Every file names its capture commit; a corpus that disagrees with the code is worse than none.
- [ ] Record completed items in `_lazycustoms/docs/VERIFICATION_LOG.md` with method and evidence.
