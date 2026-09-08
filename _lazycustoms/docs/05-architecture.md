# CHAT_AGENT_BUILD — Storefront Chat Agent

**Status: Concept.** Nothing built. Nothing tested.

**Why this workstream is unblocked:** it runs on a **separate development store**. It is the one piece of work that proceeds while Lazy Customs stays under construction.

---

## 1. Architecture — backend or frontend is a false choice

Shopify's reference design is **both**, as one app:

- **Backend** — a React Router app server that handles communication with the LLM, processes chat messages, and acts as an **MCP client**. **[Verified]**
- **Chat UI** — a **Shopify theme extension** providing the customer-facing chat window. **[Verified]**

There is no frontend-only version. An API key in theme code is publicly exposed.

The MCP architecture is model-agnostic — the LLM is swappable. Claude is the reference default, not a structural requirement. **[Verified]**

```
Customer
   │
   ▼
Chat UI  (Shopify theme extension — frontend)
   │
   ▼
Backend  (React Router app — MCP client, holds API key)
   ├──────────────► LLM API
   └──────────────► Shopify MCP
                     ├── /api/mcp        → cart, policies
                     └── /api/ucp/mcp    → search_catalog, lookup_catalog, get_product
```

---

## 2. Prerequisites — Mr. Peace supplies these personally

Champion does not create accounts or enter credentials.

- [ ] Shopify Partner account
- [ ] Development store
- [ ] Claude API key from console.anthropic.com
- [ ] Node.js 18 or higher **[Verified requirement]**

---

## 3. Step 0 — Audit before cloning. Do not skip.

**Blocking risk.** Catalog tools moved from `/api/mcp` to `/api/ucp/mcp` (announced 2026-04-22, legacy sunset 2026-06-15). Cart tools `get_cart`/`update_cart` on `/api/mcp` were maintained only until **2026-08-31**. **[Verified]**

The `shop-chat-agent` README documents `search_shop_catalog` and `update_cart` — pre-migration names. **[Verified README content]**

**Audit procedure:**
1. Open `github.com/Shopify/shop-chat-agent`, branch `main`.
2. Check commit dates on `app/mcp-client.js`.
3. Search the codebase for `search_shop_catalog` and `/api/mcp`.
4. If the migration has not landed → the scaffold targets a dead endpoint. Record in `IMPLEMENTATION_LOG.md` and resolve `DECISIONS.md` D6 before proceeding.

Also anticipated: a reported `react-router` 6-vs-7 dependency conflict on `npm install`. **[Project Record — third-party report, unverified]**

Ten minutes here can prevent a week against a deprecated surface.

---

## 4. Toolchain

```bash
node -v                              # must be >= 18
npm install -g @shopify/cli
npm install -g @shopify/ucp-cli
```

The UCP CLI provides structured commands to search the Catalog, build carts, create checkouts, hand off buyers, and track orders. **[Verified]**

**Connect VS Code to Shopify's live schema.** Command Palette > Chat: Install Plugin From Source:
```
https://github.com/Shopify/shopify-ai-toolkit
```
This gives the coding assistant access to Shopify documentation, API schemas, and code validation. **[Verified]**

**Why this matters more than it looks:** it checks code against the *live* schema rather than a model's recollection of it. That recollection gap is exactly what produced the deprecated-endpoint problem in Step 0.

---

## 5. Clone and configure

```bash
git clone https://github.com/Shopify/shop-chat-agent
cd shop-chat-agent
npm install
```

Create `.env`:
```
ANTHROPIC_API_KEY=...
```

**Confirm `.env` is in `.gitignore` before the first commit.** A key pushed to a public repo is compromised within minutes and must be rotated, not deleted.

---

## 6. Run against the development store

```bash
shopify app dev
```

This starts the server in development mode, tunnels it so Shopify can reach it, and provides a preview URL to install the app on the development store. **[Verified]**

---

## 7. Verification — test in this order

Each test isolates a different layer. Order matters because the failure point identifies itself.

| # | Input | Proves | If it fails |
|---|---|---|---|
| 1 | `hi` | LLM key + backend | API key, env loading, or network |
| 2 | `can you search for [product]` | MCP catalog connection | Endpoint migration — Step 0 |
| 3 | `add [product] to my cart` | Cart tools | Most likely failure given the 2026-08-31 deprecation |
| 4 | `what is your return policy` | `search_shop_policies_and_faqs` | Empty Knowledge Base — see `KNOWLEDGE_BASE.md` |

Record every run with date and raw output in `IMPLEMENTATION_LOG.md`.

---

## 8. Do not deploy to Lazy Customs yet

A chat widget on a password-protected store has no users. Deploy after `DECISIONS.md` D1 resolves.

---

## 9. Security review before production

Required before any production deployment. Do not treat protocol adoption as equivalent to security.

- [ ] API key server-side only, never in theme code or client bundle
- [ ] `.env` gitignored; key rotated if ever exposed
- [ ] Rate limiting on the chat endpoint
- [ ] Input validation on user messages — prompt-injection surface
- [ ] The bot must not surface admin or customer data; Storefront MCP is read-oriented and does not permit outside agents to edit admin data, but **your own backend's scopes are yours to constrain** **[Verified re: Storefront MCP]**
- [ ] Logging policy: what conversation content is retained, for how long, and disclosed where
- [ ] Cost controls — an unmetered public LLM endpoint is a billing exposure
- [ ] Behavior on tool failure: degrade to a human handoff, never fabricate stock or policy

**The last item is the one that damages the brand.** An agent that invents a return window is worse than an agent that says it doesn't know.

---

## 10. Status ladder

Move one rung at a time. Record the date of each promotion.

`Concept` → `Prototype` → `Proof of Concept` → `Development System` → `Production System`

**Current: Concept.**
