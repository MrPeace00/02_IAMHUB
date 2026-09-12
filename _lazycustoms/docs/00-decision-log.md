# DECISIONS — Lazy Customs

**Version:** 1.0 · **As of:** 2026-09-02

Each entry: objective, constraint, options, **decision rule**, reversibility, and the evidence that would confirm the decision worked. Record the decision and date when made. Do not delete closed entries.

---

## D1 — Password protection removal date
**Status: DECIDED 2026-09-08; current access state reverified 2026-09-12 UTC.**

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

**Reverification (2026-09-12 UTC):** `check_catalog.py --label 20260912_recheck` reports password protection inactive, homepage HTTP 200, `/products.json` HTTP 200, and 8 products. `check_discovery.py --label 20260912_recheck` reports discovery open. This supersedes the September 11 password-gate regression for current access-state claims.

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

**Reconfirmation (2026-09-12 UTC):** live catalog/discovery probes show password protection inactive and discovery unrestricted; `/.well-known/ucp` returns HTTP 200. Keep the September 11 password-gate evidence as a historical regression, not the current access state.

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

---

## D14 — Chat bubble render: first functional gate passed
**Status: DECIDED 2026-09-08 — Theme App Extension confirmed wired correctly.**

The `AI Chat Assistant` app embed was toggled **off** by default in the dev store's theme editor (`Online Store > Themes > Customize > App embeds`). Toggling it on and saving made the chat bubble render — confirmed visually as a purple bubble in the bottom-right corner of the live preview at `lazy-customs-chat-agent.myshopify.com`.

**Consequence:** the Theme App Extension (`extensions/chat-bubble`) is wired correctly end-to-end (bundling, install, embed). Per the standing checklist branching logic, this clears the way to test MCP tool calls next.

**Open item:** interaction testing (clicking into an actual conversation) could not be completed. The theme editor's live preview intercepts clicks for section-selection, and the raw dev storefront URL is password-gated (the dev store's own storefront password — separate from the resolved production password, D1/D10). Real click-through testing needs the storefront password or a context outside the theme editor preview.

**Correction (2026-09-08):** the dev store's password toggle does not map to D1/D10. On a development-plan store, password protection is **not a settable toggle at all** — Shopify locks it on with the banner "Your online store is in development. To let visitors access your store, give them the password." It only lifts on a paid plan. The unblock here is not disabling protection but simply using the password already shown in that field (`eabree`) to pass the gate and continue interaction testing.

**Decision:** Chat bubble render confirmed working. Real interaction testing deferred pending dev store storefront password.  **Date:** 2026-09-08

---

## D15 — Chat agent conversational round-trip: three-bug chain found and fixed
**Status: DECIDED 2026-09-08 — Full round trip verified in terminal log and browser.**

Testing past D14 (bubble render) surfaced three independent, stacked bugs, each masking the next:

1. **Hardcoded `localhost:3458`** in `extensions/chat-bubble/assets/chat.js` for `/chat`, chat history, and `/auth/token-status` — didn't match `shopify app dev`'s random-port + cloudflare-tunnel setup, so every request failed client-side before reaching the server. Fixed via a `ShopAIChat.APP_URL` constant sourced from a new merchant-configurable `app_url` setting in `chat-interface.liquid`.
2. **Machine-wide `ANTHROPIC_BASE_URL`** (User + Machine env vars, set previously via `claude-meter setup`) pointed at `http://127.0.0.1:7735` — a local research proxy (`C:\Users\P\claude-meter`) that simply wasn't running, causing `ECONNREFUSED` on every Claude API call system-wide (not scoped to this repo). Fixed by starting it: `C:\Users\P\.local\bin\claude-meter.exe start`.
3. **Stale/retired model ID** `claude-sonnet-4-20250514` in `app/services/config.server.js` (`AppConfig.api.defaultModel`) — Anthropic returned `404 not_found_error`. Fixed by updating to `claude-sonnet-5`.

**Verification:** confirmed independently via both the `npm run dev` terminal log (no error logged after the two post-fix MCP connections) and the actual browser chat widget (real multi-paragraph Claude response, ~5.4s stream duration vs. near-instant error before).

**Open item:** the response noted `search_shop_catalog` (the store's product-search MCP tool) isn't returning results — conversational replies work, but product search may still be broken. Needs separate investigation.

**Decision:** All three bugs fixed; conversational chat round-trip confirmed working end-to-end.  **Date:** 2026-09-08

---

## D16 — `search_shop_catalog` unavailable on the password-protected dev store
**Status: DECIDED 2026-09-08 — Root cause confirmed via direct MCP + storefront probes, not a code bug.**

After D15's fixes, "show me hoodies" still got "I don't have direct access to browse or search the product catalog" — reproducible via direct `curl` to `/chat` (bypassing the browser/theme layer entirely), with two prompt variants (`standardAssistant`, `systemShopping`), ruling out a prompt-wording issue.

**Direct evidence:**
- `curl` to the storefront MCP endpoint (`https://lazy-customs-chat-agent.myshopify.com/api/mcp`, `tools/list`) returns exactly **one** tool: `search_shop_policies_and_faqs`. `search_shop_catalog` is not exposed at all.
- `curl` to `/products.json` on the dev store returns `302` → `https://lazy-customs-chat-agent.myshopify.com/password` — confirming the dev store is still password-protected (ties to D14's finding that dev-plan stores cannot disable this toggle).

**Diagnosis:** `search_shop_catalog` requires the storefront catalog to be publicly reachable, same constraint as D1 (Shopify Catalog/AI-channel discovery requires no password gate). A password-protected store's MCP endpoint only offers tools that don't need public catalog access (policies/FAQs), withholding catalog search entirely. This is a platform-level exclusion, not a bug in `mcp-client.js`, `chat.jsx`, or the tool-formatting code (all independently verified correct).

**Consequence:** `search_shop_catalog` cannot be verified on this dev store while it remains on the (locked) development plan. To test real product search, either (a) test against the production store `lazycustoms.com` (password already off, D10, 30 real products, D12), or (b) upgrade the dev store to a paid plan to lift the password lock.

**Secondary finding (minor, non-blocking):** `app/routes/chat.jsx` line 129 (`getCustomerAccountUrls(shopDomain, ...)`) crashes with `Cannot destructure property 'mcpApiUrl' of null` when `Origin` header is absent — real browsers always send `Origin`, so this doesn't affect normal use, but the route should default to an empty object instead of assuming a non-null return. Not fixed (out of scope for this session), flagged for later.

**Decision:** `search_shop_catalog` gap is a platform-level exclusion (password-protected store), not an app bug. No further chat-agent code changes needed for this to work — needs either production testing or a paid dev-store plan.  **Date:** 2026-09-08

**Correction (2026-09-08, later same day):** password removal was necessary but **not sufficient**. The app was installed and tested against production (`lazycustoms.com`, password already off since D10, 30 real products). Direct `curl` to `https://lazycustoms.com/api/mcp` `tools/list` returns the **identical** result as the dev store — only `search_shop_policies_and_faqs`, still no `search_shop_catalog`. This rules out password protection as the sole/primary cause.

**Revised diagnosis:** `search_shop_catalog` exposure most likely depends on the full Shopify Catalog eligibility gate set documented in `02-catalog-eligibility-audit.md`, not just S3 (private mode). Remaining unresolved gates as of this session: S2 (plan tier — Unverified), S4 (policies completed — Unverified), S5 (account standing: verified email/2FA/business verification — Unverified), S6 (operating history: genuine sales, low chargebacks — **Unknown, no public operating history**). Per D1's original framing, S5/S6 are explicitly **not** a one-time checkbox — Shopify states eligibility is "reviewed over time," and genuine sales history accumulation takes **weeks to months, only by operating**. This means `search_shop_catalog` may not become available quickly regardless of further config changes — it may require sustained real store operation, not a fixable setting.

**Revised decision:** Do not expect `search_shop_catalog` to activate from further code or config changes alone. Next step is auditing S2/S4/S5/S6 directly in the Partner/Store admin to find what's still failing, while accepting that S6 in particular may be a multi-week gate tied to real operating history, not something closeable today.  **Date:** 2026-09-08

**Operational note:** the chat widget on production currently depends on the local dev server + cloudflare tunnel staying up (per the `app_url` theme setting). This is a temporary testing configuration, not a production-ready deployment — the app should be properly deployed (not tunnel-dependent) before leaving it live on `lazycustoms.com` unattended.

**Admin follow-up (2026-09-08):** Checked production Settings > Plan and Policies read-only. S2 passes the recorded tier criterion: Basic ($1 USD/month promotional price until November 4, 2026). S4 is incomplete: refund policy retains `[INSERT RETURN ADDRESS]`; terms retain `[LINK]` references and trading-name/business-contact/registration/VAT placeholders. Privacy policy is populated with automated policy enabled. These completion gaps do not establish the cause of missing MCP catalog search. See `02-catalog-eligibility-audit.md` for source links. Per user direction, S5/S6 are logged as time/process-blocked and deferred, not investigated further today. No admin settings changed.

**Authorized Terms update (2026-09-08):** Published only the approved Terms replacements: trading name, business address and phone; removed registration/VAT placeholder lines; replaced four link placeholders with three privacy-policy links and one refund-policy link. Verified on https://lazycustoms.com/policies/terms-of-service. Other template text unchanged. Refund policy remains unchanged in Shopify; revised POD-scoped draft saved in 03-refund-policy-draft.md and explicitly held pending essential-oils terms. S4 remains incomplete; S5/S6 remain deferred.

---

## D17 — Chat agent's own MCP client didn't comply with the store's Agent Terms
**Status: DECIDED 2026-09-08 — Fixed, verified against live ToS text and code.**

While independently verifying the ToS-audit report (S4 gate), a live read of `lazycustoms.com/policies/terms-of-service` found Section 14 ("Agents") is Shopify's standard Agent Terms framework: an Agent may access the Services provided it identifies itself on every request via `User-Agent: Agent/[agent name]` (14.4(i)), doesn't mimic human behavior, and answers truthfully about being non-human. Section 13(e)'s blanket "no AI tools (such as agentic AI)" language is the default; Section 14 is the compliant carve-out path — not a conflict with this project's goal, but the mechanism that legitimizes it.

**Gap found:** `app/mcp-client.js`'s four outbound requests to the store's own `/api/mcp` (customer and storefront tools/list and tools/call) set only `Content-Type` and sometimes `Authorization` — no `User-Agent` at all, let alone the required `Agent/[name]` format. The store's own chat agent was not complying with the store's own Agent Terms.

**Fix:** added a shared `AGENT_USER_AGENT = "Agent/LazyCustomsChatAssistant"` constant and included it in all four header objects in `mcp-client.js`.

**Decision:** All outbound MCP requests now self-identify per Section 14.4(i). No ToS changes needed — the policy text is already correct and standard.  **Date:** 2026-09-08

---

## D18 — Claude vision uses one sibling endpoint for uploaded and generated images
**Status: DECIDED 2026-09-12 — Implemented locally; live verification pending.**

The existing `/chat` route remains the streaming text-and-Shopify-tool contract, and `/generate-image` remains the OpenAI PNG creation contract. Image analysis uses the sibling `/vision-copy` route because it must accept multipart uploads, structured JSON responses, and a generated-image reference without complicating the established chat/tool loop.

Both front doors converge after server-side validation: customer uploads send PNG/JPEG/WebP bytes, while successful OpenAI generations expose an opaque 15-minute reference bound to the same browser session. The server verifies MIME and dimensions, strips container metadata before base64 encoding, and supplies Claude's documented image block before the text block. Claude returns text only; no Shopify Admin writes or image rendering are permitted.

NR-8 is encoded at this sibling route by accepting no customer text context at all: the browser and server exchange only the image source and the selected task. Copy and guidance use strict internal JSON with an identity-detail flag; when Claude flags a name, age, birthday, audience category, or other identity-linked detail, the server discards the model-written fields and returns fixed generic text. The identity flag is not returned, and neither output path imports a Shopify Admin or Prisma write surface.

**Decision:** Preserve `/chat` and `/generate-image`; add `/vision-copy` as the shared image-to-text endpoint. Local rung is `prerequisites tested` until the deployed browser path is recorded.  **Date:** 2026-09-12

---

## D19 — OI-8 credential rotation and revocation confirmation closed
**Status: CLOSED 2026-09-12 — Provider confirmations operator-stated; no secrets recorded.**

Mr. Peace reports that the exposed OpenAI, Anthropic if applicable, and Shopify values were rotated and that old values are now dead. Confirmation is status-only; no credential values are recorded here.

OI-8 CLOSED — 2026-09-12

- Shopify: old app secret rotated as of 2026-09-12; Railway env updated with new value; prior secret no longer active for the app.
- OpenAI: old exposed value confirmed revoked/inactive as of 2026-09-12; new value live in Railway.
- Anthropic: old exposed value confirmed inactive as of 2026-09-12; new value live in Railway.

All three provider confirmations are operator-stated. Old values are treated as dead. New values are live in Railway `valiant-liberation`. No secrets recorded here — confirmation of status only.

**Decision:** Close OI-8 based on dated operator-stated provider confirmations.  **Date:** 2026-09-12

---

## D20 — React Router audit conflict is corrected forward and remediated
**Status: DECIDED 2026-09-12 — Compatible fix verified locally.**

The `package-lock.json` at D-103-era commit `70395ac` and immediately before this correction has the same Git blob (`fcd6ec05722c8d9e82769e5f3e6b590d9eab777d`) and resolves React Router to `7.11.0`. The September 9 verification row also retained React Router findings. This rules out a later dependency rollback and shows that D-103's blanket statement that the React Router chain was remediated was overbroad.

The five directly declared React Router packages were upgraded as one matched family to `7.18.3`, which satisfies the official `7.18.0` patched-version floor for GHSA-chx6-hx7r-mcp5. A normal clean install, tests, lint, typecheck, and production build pass. The post-remediation production audit contains four high package entries, all in the existing Prisma/deepmerge chain; OI-9 remains open only for that narrower chain.

**Decision:** Correct D-103 forward without erasing it, accept the compatible React Router remediation, and retain only the Prisma/deepmerge chain under OI-9. Evidence: `ops/evidence/dependency_audit_reconciliation_20260912_20260912T034713Z.md`.  **Date:** 2026-09-12
