# Repository map

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.

## Top level

| Path | What it is |
| --- | --- |
| `shop-chat-agent-main/` | The chat agent application. React Router (v7 file-system routes) on Node, Prisma/SQLite, deployed to Railway. |
| `_lazycustoms/docs/` | Project records: decision log, architecture, audits, `CURRENT_STATE.md`, `VERIFICATION_LOG.md`. |
| `_lazycustoms/ops/` | Python check scripts and dated evidence files under `ops/evidence/`. |
| `_gemini/` | This corpus. |

## Application layout

```
shop-chat-agent-main/
  app/
    routes/          HTTP surface (file-system routed)
    services/        server-side logic, one concern per file
    prompts/         prompts.json - the model's shopping policy
    mcp-client.js    Shopify storefront + customer MCP client
    db.server.js     Prisma client
  extensions/
    chat-bubble/     the Shopify theme app extension
      assets/        chat.js, chat.css, lazy-home.js, lazy-home.css, lazy-chat-hub.png
      blocks/        chat-interface.liquid, lazy-home.liquid
      locales/       en.default.json
  tests/             node:test suites, no test framework dependency
  scripts/           operational scripts
  prisma/            schema and migrations
```

## Routes

| Route file | Purpose |
| --- | --- |
| `routes/chat.jsx` | The one conversational endpoint. Starter dispatch, SSE stream, AI tool loop. |
| `routes/generate-image.jsx` | OpenAI image generation. `loader` and `action`. |
| `routes/vision-copy.jsx` | Image-informed copy via Claude. `loader` and `action`. |
| `routes/auth.$.jsx`, `auth.callback.jsx`, `auth.token-status.jsx` | Shopify OAuth and customer-account token handling. |
| `routes/api.webhooks.jsx` | Shopify webhooks. |
| `routes/app.jsx`, `app._index.jsx` | Embedded Shopify admin app. |
| `routes/_index/route.jsx` | App root page. |

## Services

| Service | Concern |
| --- | --- |
| `starter-intent.server.js` | Starter allowlist, deterministic dispatch, customer product URL validation. |
| `global-fulfillment.server.js` | The verified-fulfillment gate: config, evidence-freshness, live product/variant/shipping checks, and every failure state. |
| `global-fulfillment-evidence.server.js` | Human-observed anchor record (24-hour window) for the one verified Printify Choice product. |
| `catalog-priority.server.js` | Enriches catalog results with vendor metadata from the store's own `/products.json`; applies provider preference. |
| `tool.server.js` | Normalizes tool results into product cards. Caps display at `AppConfig.tools.maxProductsToDisplay` = 8. |
| `ai.server.js`, `anthropic.server.js`, `openai.server.js`, `openai-format.js` | Provider selection and per-provider request shaping. |
| `streaming.server.js` | SSE stream manager: `sendMessage`, `sendError`, `closeStream`, `handleStreamingError`. |
| `cors.server.js` | Origin allowlist and CORS headers. |
| `config.server.js` | `AppConfig` — model, token cap, tool round cap, error strings, product display cap. |
| `printify.server.js` | Printify **order** client: `getOrder`, `refreshOrder`, `submitOrder`. Not a catalog client. |
| `fulfillment-record.server.js` | Telemetry-only fulfillment records via an explicit field allowlist. |
| `vision-image.server.js`, `vision-copy.server.js` | Image generation and image-informed copy. |
| `generation-rate-limit.server.js` | Per-session and per-IP limits for generation and vision. |

## Reading order for a newcomer

1. `10_UI_SURFACES.md` — what a customer sees.
2. `20_UX_STARTER_FLOWS.md` — what happens when they press a button.
3. `32_SHOPIFY_BACKEND_CONTRACT.md` — the wire format between the two.
4. `31_SHOPIFY_CATALOG_AND_MCP.md` — where products come from.
