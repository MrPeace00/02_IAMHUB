# UX — artwork and personalization

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `app/routes/generate-image.jsx`, `app/routes/vision-copy.jsx`, `app/services/vision-image.server.js`, `vision-copy.server.js`, `generation-rate-limit.server.js`, `assets/lazy-home.js`.

Personalization is **optional and secondary**. The shopping policy places it after product selection, never before.

## Two entry points, both on the homepage block

Inside a collapsed `<details>` labelled "Optional: create or upload artwork":

| Control | Endpoint | Provider |
| --- | --- | --- |
| "Create with OpenAI" (`[data-lazy-art-start]`) | `POST /generate-image` | OpenAI image generation |
| "Upload for Claude" (`[data-lazy-image-upload]`) | `POST /vision-copy` | Claude, image-informed copy |

The file input accepts `image/png,image/jpeg,image/webp` and is visually hidden behind its label.

Both routes export a `loader` and an `action`.

## Artwork mode

`lazy-home.js` holds an `artMode` flag. Entering it via the art chip or button re-weights suggestion chips toward artwork prompts. Pressing either starter clears `artMode` and hides the quiz first, so a shopping request never inherits artwork state.

## Rate limiting

`generation-rate-limit.server.js` exports `enforceGenerationRateLimit` and `enforceVisionRateLimit`, each keyed on a validated session id and the client IP (`getClientIp`), raising `GenerationRateLimitError`. Image generation and vision are limited separately.

## The claim boundary

Generated artwork is **a downloadable design**. Per the shopping policy it is not automatically attached to a cart or a paid order. The flow for a Printify product is: open the returned Shopify product page, choose options, save personalization there, then add to cart.

The policy explicitly forbids creating or adding a personalized Printify line through chat cart tools, because that bypasses the saved design. It also forbids telling a customer that a generated image was sent to production, or that an order was placed, without confirmation.

Personalization support must be verified on the actual product before it is promised — a customizable surface in the catalog is not the same as a text-on-image field.
