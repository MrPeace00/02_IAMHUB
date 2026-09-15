# Lazy Chat — open work

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Ordered by what unblocks the most. Every item names what closes it, so none of them is a standing wish.

## Blocking — do these first

- [ ] **Rotate the leaked Printify API token.** A token with `orders.write`, `products.write` and `uploads.write` scopes, valid to roughly September 2027, was pasted into a chat transcript on 2026-09-14. Printify → My profile → Connections → delete and regenerate. *Closes when:* the old token is deleted in the Printify console.
- [ ] **Run the Printify discovery script and return its output.** `node scripts/inspect-printify-catalog.mjs` with the new token in `.env`. GET-only. *Closes when:* the product-object field names for eligibility and destination coverage are known from the live API. *Blocks:* every verified-eligibility item below.

## The Global fulfillment gate

- [ ] **Implement verified Choice eligibility** against the real field names. Until then `global-fulfillment.server.js` may only say a product is Printify-made. *Blocked until:* the discovery output exists.
- [ ] **Implement destination coverage and the country question.** Deliberately deferred — no source can check coverage, so asking for a country would collect an answer nothing can act on. *Blocked until:* the same output.
- [ ] **Decide the alternative path:** a product-owner-confirmed customer-facing Printify URL (for example a Pop-Up Store) would let Global fulfillment link out instead of resolving eligibility in-app. *Closes when:* Mr. Peace confirms such a URL exists, or confirms none will.
- [ ] Add provider timeout, cancellation, authorization, rate-limit and malformed-response handling once a real provider call exists. Current exception tests inject failures at the service boundary and are **not** evidence of a working integration.

## Small, unblocked, worth doing now

- [ ] **Verify the store-alias assumption.** `customerProductUrl` canonicalizes `vbw9zu-f7.myshopify.com` and `lazy-customs-2.myshopify.com` product paths onto `lazycustoms.com`. Rests on `CURRENT_STATE.md` and `07-repo-audit.md`, not a live check. *Closes when:* one `curl -I` per alias for one known handle returns the same product.
- [ ] **Restore server-side logging in the `POST /chat` catch block.** Genericizing the client body was right; dropping `console.error` removed the only diagnostic signal for a 500.
- [ ] **Handle a missing `Origin` header explicitly** in the Shopify starter. It currently throws into the catch and reports `catalog_unavailable`, so every non-browser probe looks like a provider outage.
- [ ] **Fix the unused `welcome_message` setting.** The widget schema defines it; the inline config hard-codes `"Heyyy"`. Either wire `block.settings.welcome_message` through or remove the setting.
- [ ] **Reconsider `maximum-scale=1.0, user-scalable=no`** in `chat-interface.liquid`. It suppresses pinch-zoom for the whole page, not just the widget.

## Decide and act

- [ ] **Decide what happens to branch `claude/sharp-franklin-4q9u8d`.** It carries the starter separation, the Global fulfillment fix, the `.gitattributes` binary fix, and the discovery script. PR #1 was closed without merging on 2026-09-14 and was not reopened. *Closes when:* the branch is merged, reworked, or abandoned deliberately.
- [ ] **Deploy, or decide not to.** Nothing in this branch has been deployed: no Railway redeploy, no Shopify extension release. *Closes when:* a deploy is performed and recorded in `VERIFICATION_LOG.md`, or the decision to hold is logged in `DECISIONS.md`.
- [ ] **Live-verify both starter buttons in a browser** after any deploy. Every current test uses service and DOM fakes; none establishes live behavior.

## Hygiene

- [ ] Regenerate `_gemini/*.md` whenever the repository moves. Each file names commit `fc30960`; a corpus that disagrees with the code is worse than none.
- [ ] Record any of the above that completes in `_lazycustoms/docs/VERIFICATION_LOG.md` with method and evidence, per the existing table format.
