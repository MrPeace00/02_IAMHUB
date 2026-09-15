# UX — the two starter flows

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/routes/chat.jsx`, `app/services/starter-intent.server.js`, `app/services/global-fulfillment.server.js`.

## The fact that shapes everything

**Lazy Customs has one catalog.** Printify Choice is an order-routing option applied at fulfillment, not a browsable storefront, so there is no second product source. Both starters read the same catalog.

They are separated on three axes, in this order:

1. **Code path** — a deterministic server dispatcher runs before any AI or account discovery.
2. **Products kept** — Global fulfillment filters to Printify-made products; Shopify keeps the whole catalog.
3. **Permitted claims** — see `22_UX_CLAIMS_AND_COPY.md`.

The historical defect was that both surfaces sent different *prose* into the same LLM tool loop, so the difference depended on what the model did with a sentence. The dispatcher removed that.

## Dispatch order

```
POST /chat
  -> reject non-object body or unknown intent            400
  -> reject non-string / blank message                   400
  -> dispatchStarter(intent, ...)
       intent undefined -> null -> existing general chat flow
       intent present   -> deterministic source, SSE, end_turn, return
```

Neither starter reaches `createAIService` or customer-account discovery. Both read the catalog through the storefront MCP client with `{ catalog: { query: '' } }` and provider preference `any`.

## Global fulfillment

`searchGlobalFulfillment({ searchCatalog })` filters the approved catalog by `printifyFulfilled` — vendor matching `/^printify$/i`.

| Outcome | `state` | `reason` |
| --- | --- | --- |
| Printify-made products found | `catalog` | — (plus `fulfillment: 'printify_network'`) |
| Catalog read, no vendor known on any product | `unavailable` | `vendor_metadata_unavailable` |
| Vendors known, none Printify | `unavailable` | `no_printify_fulfilled_products` |
| No catalog function supplied | `unavailable` | `catalog_source_not_configured` |
| Source threw | `unavailable` | `provider_unavailable` |

The first two `unavailable` rows carry **different messages on purpose**. "We could not read it" and "there are none" are different facts, and merging them would tell a customer the store carries nothing Printify-made whenever a network read failed.

## Shopify

Whole catalog, any provider, no fulfillment claim. Two outcomes: `catalog` with products, `catalog` with an empty list and a "no approved customer pages" message, or `unavailable` / `catalog_unavailable` if the read threw.

## Intent is request-scoped

The server never infers intent from message wording, conversation history, or `prompt_type`. A follow-up message in the same conversation omits `intent` and goes through the general chat flow. Pressing the other starter explicitly selects that route. No persistent "global mode" exists.

## No delivery-country question

No branch asks for a delivery country. This is deliberate: no connected source can check destination coverage, so the answer could not be acted on. The prompt policy in `prompts.json` carries the same instruction for free-form chat, and a regression test asserts no message asks for one.
