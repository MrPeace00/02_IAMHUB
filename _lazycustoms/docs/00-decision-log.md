# DECISIONS — Lazy Customs

**Version:** 1.0 · **As of:** 2026-09-02

Each entry: objective, constraint, options, **decision rule**, reversibility, and the evidence that would confirm the decision worked. Record the decision and date when made. Do not delete closed entries.

---

## D1 — Password protection removal date
**Status: OPEN. Highest priority. Everything downstream depends on this.**

**Objective:** AI-channel and organic visibility for Q4.

**Constraint (verified):** A store in private mode is excluded from Shopify Catalog and from AI channels. Behind a password there is nothing to crawl, so the open-web fallback path is also closed. **[Verified + Inference]**

**Timing evidence:**

| Gate | Duration | Controllable |
|---|---|---|
| Remove password, publish products, assign channels | Hours | Yes |
| Catalog sync after eligibility | Reported 24–72 hrs **[Unverified — third-party]** | No |
| Account standing review — "reviewed over time" **[Verified]** | Unknown | No |
| Genuine sales history accumulation **[Verified requirement]** | Weeks to months | Only by operating |

Q4 opens 2026-10-01. Today is 2026-09-02.

**Decision rule:**
- If AI-channel visibility in Q4 is a real objective → password comes off **in September**, not October.
- If construction cannot finish in September → explicitly record Q4 AI-channel revenue as **Unknown trending toward zero**, and reallocate Q4 effort to channels under direct control.
- Do not hold both beliefs simultaneously.

**Middle path available:** launch publicly with finished products only; keep unfinished products in Draft. Draft products are excluded from Catalog regardless, so staging this way forfeits nothing not already forfeited. A thin live store accrues account standing. A complete hidden store accrues none. **[Inference]**

**Reversibility:** High. Password protection can be re-enabled at any time. Account-standing history, once started, is not lost by re-enabling.

**Verification that it worked:** non-empty response from the `search_catalog` curl in `IMPLEMENTATION_LOG.md`, plus a non-zero product count in the admin Catalog feed.

**Session note (2026-09-08):** dev environment setup for `shop-chat-agent-main` hit the store password gate exactly as this entry predicted — `shopify app dev` prompted for the storefront visitor password against the dev store. This confirms the prediction but does not close the decision.

**Decision:** Password protection removed from the production store (`lazy-customs-2`). See D10 for verification method and access-state details.  **Date:** 2026-09-08

---

## D2 — Publish or keep Draft: the 4 draft products
**Status: OPEN**

Draft is not a "later" state for AI purposes. It is exclusion. **[Verified]**

**Decision rule:** publish any product whose data meets the `PRODUCT_DATA_SPEC.md` minimum (title, ≥1 image, price > 0, category, core attributes). Keep in Draft only products that fail that minimum — and treat the failure as a data task, not a status decision.

**Decision:** _______  **Date:** _______

---

## D3 — Sales-channel assignment for 0-channel Active products
**Status: OPEN**

Products must be published to online store, Hydrogen, or Headless. **[Verified]**

**Decision rule:** assign every D2C product to Online Store. There is no case where an Active product intended for sale should sit at 0 channels.

**Decision:** _______  **Date:** _______

---

## D4 — GEO before SEO
**Status: DECIDED 2026-09-02 — GEO is priority 1, SEO priority 2.**

**Note on execution:** these are largely the same work with two payoffs, not two competing workstreams. Complete titles, real attributes, answer-shaped descriptions, populated metafields, and completed policies serve Catalog ingestion, schema markup, and on-page SEO simultaneously. **[Verified guidance + Inference]**

The genuinely GEO-specific additions are: Shopify Catalog Mapping configuration, and the Knowledge Base answers.

**Consequence of the ordering:** where the two conflict, write for attribute extraction rather than keyword density. Keyword-stuffed copy is a net negative under GEO.

---

## D5 — Design-prompt bot: build order
**Status: OPEN**

**Decision rule:** build the **prompt coach first** — platform-agnostic, no vendor API dependency, functions while the store is still password-protected. Add Printify automation second (API Verified). Treat Tapstitch automation as **Unknown pending vendor verification**.

**Unresolved policy question that must be answered before launch, not after:** a bot generating customer-directed artwork creates IP-infringement exposure the first time a customer requests a copyrighted character or celebrity likeness. This requires a moderation policy decision. **[Open]**

**Decision:** _______  **Date:** _______

---

## D6 — Chat agent scaffold: adopt or rebuild `shop-chat-agent`
**Status: DECIDED 2026-09-02 — Adopt and patch `shop-chat-agent-main` fork.**

The reference repo is structurally sound, modern (React Router v7, Prisma 6, Vite 6, Anthropic SDK 0.40), and contains all critical infrastructure: Shopify OAuth, session storage, Theme App Extension chat bubble, MCP JSON-RPC client, and Claude streaming.

**Decision rule:** audit current `main` first. The repository audit (`python _lazycustoms/ops/audit_repo.py --path shop-chat-agent-main --write-report`) passed all checks. The fork provides complete Shopify app scaffolding. Patching `shop-chat-agent-main` with custom prompts from `_lazycustoms/chat-agent-additions/prompts` and configuring MCP tool routes is far lower risk and effort than building a client from scratch.

**Decision:** Adopt and patch `shop-chat-agent-main`.  **Date:** 2026-09-02

---

## D7 — Store policies
**Status: OPEN**

Terms of service, Privacy policy, and Return and refund policy are a **verified requirement** for agentic storefronts. **[Verified]**

**Decision rule:** not a decision. A requirement. Verify present and non-empty; write if absent.

**Decision:** _______  **Date:** _______

---

## D10 — Retail-only storefront confirmed (production access)
**Status: DECIDED 2026-09-08 — Password protection and B2B restriction both turned off.**

Closes D1's access gate. Production store `lazy-customs-2` (`lazycustoms.com`) had two independent access restrictions in Online Store → Preferences: storefront password protection, and "Restrict access to B2B customers only." Both were found enabled and were disabled in the same session.

**Verification method:** two-method check — (1) settings toggle confirmed off and saved, (2) live storefront load confirmed with Shopify's "Online store is open to everyone" banner. This two-method standard (setting + live load) should be held for any future production access-setting change.

**Consequence:** retail customers can access `lazycustoms.com` directly; AI crawlers and shopping agents can reach the storefront. The catalog *feed* is a separate blocker — this decision only clears the access side (§9.4). Draft products (D2) and zero-channel Active products (D3) remain open and block full catalog visibility (§9.1, §9.2).

**Decision:** Password protection OFF, B2B restriction OFF, verified by settings toggle + live storefront load.  **Date:** 2026-09-08

---

## D8 — Dev store for `shop-chat-agent-main` local development
**Status: DECIDED 2026-09-08 — Created dedicated dev store, kept separate from production.**

`shopify app dev` required a linked development store to preview the chat-bubble theme extension and app-preview session. No existing dev store was associated with the org's Dev Dashboard.

**Decision rule:** create a store scoped to development only, never point local dev at the production store.

**Decision:** Created `lazy-customs-chat-agent.myshopify.com` as the dedicated dev store, separate from production `lazycustoms.com`.  **Date:** 2026-09-08

---

## D9 — App handle for `shop-chat-agent-main`
**Status: DECIDED 2026-09-08 — Renamed handle to resolve collision.**

`shopify.app.toml` shipped with `handle = "shop-chat-agent"`, which collided with an existing app of the same handle in the org (from earlier failed app-creation attempts), causing `shopify app dev` to fail with "App handle must be unique."

**Decision rule:** app handles must be unique per org; scope the handle to the project/brand rather than the generic fork name.

**Decision:** Set `handle = "lazy-customs-chat-agent"` in `shopify.app.toml`.  **Date:** 2026-09-08

---

## D11 — `check_catalog.py` / `check_discovery.py` stale hardcoded logic
**Status: DECIDED 2026-09-08 — Rewrote both scripts to make live HTTP probes.**

Both scripts printed a hardcoded "password protection active" result regardless of actual store state — they never made a network request. This produced a false-negative baseline report *after* D10 had already resolved the password gate.

**Decision rule:** verification scripts must probe the live system, not assert an assumed state.

**Fix:** rewrote both scripts (stdlib `urllib` only, no new dependency) to:
- `check_catalog.py` — GETs the homepage to detect the Shopify password-gate markup, and GETs `/products.json` to count live catalog products.
- `check_discovery.py` — checks the homepage for the password gate, `robots.txt` for a blanket `Disallow: /`, and the homepage for a `noindex` meta tag.
- Both write timestamped JSON evidence to `ops/evidence/` on every run.

**Baseline result after rewrite (2026-09-08, label `baseline`):** password protection OFF, catalog feed **eligible with 30 products**, discovery mode **open** (no robots block, no noindex). This corrects the earlier assumption that the catalog feed was still empty — §9.1/§9.2 (Draft and zero-channel products) may still apply to specific SKUs, but the feed overall is not empty.

**Decision:** Scripts rewritten to live-probe; baseline evidence captured in `ops/evidence/catalog_check_baseline_*.json` and `ops/evidence/discovery_check_baseline_*.json`.  **Date:** 2026-09-08

---

## D12 — 34-product feed gap (§9.2): confirmed real, not a pagination artifact
**Status: OPEN — root cause unconfirmed, candidates narrowed.**

Admin product count (2026-09-08): 72 total, 5 Draft, 3 Unlisted, 64 Active. Public `/products.json` feed: 30 products. Gap: **34 Active products missing from the feed**, larger than the originally scoped 4 named Drafts.

**Ruled out:** pagination limit. Added `--page` support to `check_catalog.py` and a full paginated walk (`walk_all_pages`, requests `limit=250` per page, loops until a short/empty page). Page 2 returned 0 products; the full walk confirms 30 total across 1 page. The 30-product figure is the genuine feed total, not a truncated first page.

**Remaining candidates, in order of likelihood:**
1. Active products not assigned to the Online Store sales channel.
2. Products published to a different channel only (POS, custom app channel).
3. Availability/publish date set in the future (scheduled, not yet live).

**Decision rule:** audit the 34 missing Active products' channel assignments and scheduled-availability dates in Admin → Products before assuming a data-quality problem with the products themselves.

**Decision:** _______  **Date:** _______

---

## D13 — Baby/nursery Draft products are abandoned scaffolds, not the live catalog
**Status: DECIDED 2026-09-08 — Confirmed by direct product inspection.**

The 4 named Draft products (Plush Crib Mobile, Baby Sleep Sack, Nursery Wall Art Plaque, Cotton Baby Bibs) plus a 5th (Family Name Coaster Set) were treated in `02-catalog-eligibility-audit.md` as pending real inventory. Direct inspection shows: vendor still set to Shopify's unedited placeholder "Your Brand", no image uploaded, no sales, category unconfirmed (suggested category still pending acceptance). These are unfinished manual scaffolds that were started and abandoned.

By contrast, an Active apparel product (Stand Collar Bomber Jacket) has vendor "ODMPOD" (a print-on-demand app's auto-import), a real product photo, and real inventory numbers — consistent with the 30-product live feed being genuine POD-imported apparel/candle/fragrance inventory.

**Consequence:** the 5 baby/nursery Drafts are out of scope for the D12 (§9.2) 34-product feed-gap audit. That audit targets the **Active apparel/candle/fragrance products only** — the real, live business. `02-catalog-eligibility-audit.md`'s "known products requiring audit" list has been corrected accordingly.

**Decision:** Baby/nursery Drafts excluded from §9.2 scope; treated as an abandoned product line, not active/removed inventory.  **Date:** 2026-09-08
