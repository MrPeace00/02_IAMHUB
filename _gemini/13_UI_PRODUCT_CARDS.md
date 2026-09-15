# UI — product cards

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/services/tool.server.js`, `app/services/config.server.js`, and the render paths in `assets/chat.js` and `assets/lazy-home.js`.

## The card shape

`createToolService().processProductSearchResult` normalizes every catalog result into this and nothing more:

```js
{ id, title, vendor, price, image_url, description, url }
```

- `id` — `product.id` or `product.product_id`; falls back to a random `product-xxxxx` string when both are absent.
- `vendor` — passed through only when it is a string, else `''`.
- `price` — formatted from `price_range.min` when present, using `Intl.NumberFormat` with the currency's own fraction digits; falls back to the first variant, then to the literal `"Price not available"`.
- `description` — the string, or `description.plain`, or `''`.
- `url` — `product.url` or `''`.

## Display cap

`AppConfig.tools.maxProductsToDisplay` is **8**. The slice happens in `processProductSearchResult` before formatting, so the cap applies to every surface at once.

## URL approval

Cards from the starter paths pass through `customerProductUrl` in `starter-intent.server.js` before display. A card whose URL does not survive is dropped entirely rather than rendered without a link. See `22_UX_CLAIMS_AND_COPY.md` for the allowlist.

## Ordering

`catalog-priority.server.js` preserves the search tool's relevance order within each provider group and uses a stable sort, so equal-rank products keep the order the catalog returned. Under `provider_preference: 'any'` — what both starters use — no reordering is applied at all.

## Failure rendering

An empty product array renders no card area rather than an empty container. On the Global fulfillment path the widget additionally suppresses the `product_results` event when the array is empty, so an `unavailable` state shows its message alone.
