# IMPLEMENTATION_LOG — Lazy Customs UCP / Agent Work

**Purpose:** Prevent stale assumptions from being carried forward silently as the UCP spec and Shopify's implementation change.

**Rule:** Every entry records documentation source, date checked, capability evaluated, finding, test status, production status. When something changes, **add a new row**. Do not edit history.

---

## Doc-check log

| Date | Source | Capability evaluated | Finding | Status |
|---|---|---|---|---|
| 2026-09-02 | help.shopify.com/en/manual/shopify-catalog/requirements | Catalog eligibility | Private mode disqualifies store-wide; products need title, ≥1 image, price > 0, publication to Online Store / Hydrogen / Headless, identifiable product URL, not Unlisted, not hidden from search engines | Verified. Blockers unresolved |
| 2026-09-02 | help.shopify.com/.../agentic-storefronts/products | Discovery files | `/agents.md` canonical; `/llms.txt` and `/llms-full.txt` for older crawlers; all three served automatically, no app needed; overridable via `agents.md.liquid` etc. | Verified. Not yet customized |
| 2026-09-02 | help.shopify.com/.../agentic-storefronts/products | Private-mode exclusion | Storefronts in private mode excluded from AI channels | Verified. Blocker B1 |
| 2026-09-02 | help.shopify.com/.../agentic-storefronts/requirements | Channel availability | ChatGPT available to eligible stores; Copilot and Google AI Mode/Gemini in early access | Verified. Store-specific status Unknown |
| 2026-09-02 | shopify.dev/docs/apps/build/storefront-mcp/servers/storefront | MCP endpoints | `/api/mcp` = cart + policies; `/api/ucp/mcp` = `search_catalog`, `lookup_catalog`, `get_product`; UCP catalog tools require an agent profile in every request; no authentication required | Verified. Untested on this store |
| 2026-09-02 | shopify.dev/changelog | Cart MCP deprecation | `get_cart` / `update_cart` on `/api/mcp` deprecated in favour of UCP Cart MCP; maintained until 2026-08-31 | Verified. Date has passed |
| 2026-09-02 | shopify.dev/docs/agents | Toolchain | UCP CLI `@shopify/ucp-cli`; Shopify AI Toolkit plugin; Node.js 18+ required | Verified. Not yet installed |
| 2026-09-02 | github.com/Shopify/shop-chat-agent | Reference app | README documents `search_shop_catalog` and `update_cart` — pre-migration tool names. Architecture: React Router backend as MCP client + theme extension chat UI | Verified README content. Current `main` currency **Unverified** |
| 2026-09-02 | developers.printify.com | Printify API | Media library upload by URL or base64; image IDs referenced on product create/update; DPI validation errors common on low-quality artwork; scale 1.00 at x=0.5 y=0.5 fills print area; Printify "publish" only locks on Printify — store-side creation is separate | Verified. Untested |
| 2026-09-02 | — | Tapstitch API | No public developer documentation located | **Unknown.** Verify with vendor |

---

## Test log

Record every test run. A test with no recorded date and raw output did not happen.

| Date | Test | Command / method | Result | Notes |
|---|---|---|---|---|
| | Catalog reachability | curl below | | |
| | `/agents.md` content | browser | | |
| | Admin Catalog product count | Sales channels > Agentic | | |

### Standing test — Catalog reachability

Run after every eligibility change. Record raw output and timestamp.

```bash
curl -s https://lazy-customs-2.myshopify.com/api/ucp/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","method":"tools/call","id":1,
    "params":{
      "name":"search_catalog",
      "arguments":{
        "meta":{"ucp-agent":{"profile":"https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json"}},
        "catalog":{"query":"baby"}
      }
    }
  }'
```

**What this proves:** an empty result set here is the same failure an outside agent hits. This converts "the admin says 0" into a reproducible dated artifact.

**What it does not prove:** an empty response does not identify *which* upstream gate failed. Shopify also notes some stores may restrict access. **[Verified]**

---

## Open questions requiring evidence

| Question | Why it matters | How to resolve |
|---|---|---|
| Does `lazy-customs-2` meet account-standing criteria? | Gates Catalog inclusion entirely | Not observable in admin. Only resolvable by operating publicly over time |
| Direction of the pending Preferences password toggle | Saving the wrong direction forfeits store-wide eligibility | Open Settings > Preferences and read it before touching |
| Current state of `shop-chat-agent` `main` | Determines whether the scaffold is usable | Check commit dates on `app/mcp-client.js` |
| Does Tapstitch expose a public API? | Determines whether design automation is possible on that platform | Contact vendor |
| Are all three required policies present? | Verified requirement for agentic storefronts | Settings > Policies |
