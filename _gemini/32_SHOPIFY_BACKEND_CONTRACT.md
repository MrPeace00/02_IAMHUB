# Shopify frontend — the backend contract

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/routes/chat.jsx`, `app/services/cors.server.js`, `streaming.server.js`, `config.server.js`.

The single wire format between both theme surfaces and the app.

## Request

```
POST <app_url>/chat
Content-Type: application/json
Origin: <storefront origin>
X-Shopify-Shop-Id: <shop id>
```

```json
{
  "message": "Show me products made for global fulfillment.",
  "intent": "global_fulfillment",
  "conversation_id": "existing-conversation",
  "prompt_type": "systemShopping",
  "quiz": { "...": "optional, homepage quiz only" }
}
```

| Field | Rule |
| --- | --- |
| `message` | Required. Must be a non-empty string after trimming, else 400. |
| `intent` | Optional. `global_fulfillment` or `shopify_catalog` only. Any other value — including explicit `null` — is 400 **before any source call**. |
| `conversation_id` | Optional. Returned on the `id` event and stored in `sessionStorage`. |
| `prompt_type` | Selects the system prompt. Never used to infer intent. |
| `quiz` | Optional structured context from the homepage quiz. |

A body that is not a plain object — null, an array — is 400.

## Response

`text/event-stream`, one JSON object per `data:` line. Event types are listed in `21_UX_STATE_AND_FEEDBACK.md`.

The `starter_result` event:

```json
{
  "type": "starter_result",
  "intent": "global_fulfillment",
  "state": "catalog",
  "fulfillment": "printify_network",
  "message": "...",
  "products": [],
  "reason": "optional machine-readable failure code"
}
```

`state` is `catalog` or `unavailable`. **No branch emits `verified`.** `fulfillment` appears only on the Global fulfillment success path.

## Starter turn shape

```
id -> starter_result -> chunk -> message_complete -> product_results -> end_turn
```

Both the user message and the assistant message are persisted. Provider payloads are never stored — only the customer-visible copy.

## CORS

`cors.server.js` holds four production origins: `lazycustoms.com`, `www.lazycustoms.com`, `lazy-customs-2.myshopify.com`, `vbw9zu-f7.myshopify.com`. `ALLOWED_ORIGINS` (comma-separated) adds more. Outside production, the two localhost dev ports are added.

`isAllowedOrigin` requires the header to be present, parseable, and **exactly equal** to its own parsed origin — which rejects a header carrying a path or trailing content. `Access-Control-Allow-Origin` is echoed only for an allowed origin; `Vary: Origin` is always set.

Permitted headers: `Content-Type, Accept, X-Lazy-Session, X-Shopify-Shop-Id`. Preflight cached 86400s.

## AppConfig limits

| Key | Value |
| --- | --- |
| `api.defaultModel` | `gpt-5.6` |
| `api.maxTokens` | 2000 |
| `api.maxToolRounds` | 6 |
| `api.defaultPromptType` | `standardAssistant` |
| `tools.maxProductsToDisplay` | 8 |

## A real fragility

The Shopify starter derives the shop origin with `new URL(request.headers.get('Origin')).origin`. A request with **no** `Origin` header throws, is caught, and returns `catalog_unavailable`. Any non-browser probe — including the `curl` checks used in `VERIFICATION_LOG.md` — therefore sees "temporarily unavailable" and can be misread as a provider outage. See `TODO.md`.
