# UI — homepage block

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `extensions/chat-bubble/blocks/lazy-home.liquid`, `assets/lazy-home.js`, `assets/lazy-home.css`.

Rendered only on the `index` template. Class prefix `lazy-home__`.

## Structure

```
.lazy-home[data-lazy-home]           data-backend-url, data-shop-id
  .lazy-home__surface
    .lazy-home__start
      eyebrow "CUSTOM, WITHOUT THE COMPLICATED"
      h1.lazy-home__wordmark          "Lazy." aria-label "Lazy Customs"
      intro "Tell us what you have in mind."
      .lazy-home__image-doors         Global fulfillment | Shopify
      explainer paragraph
      <details> Optional: create or upload artwork
        Create with OpenAI | Upload for Claude (+ hidden file input)
      form[data-lazy-quiz-form]       six-field quiz
      "Or describe exactly what you want"
      form[data-lazy-form]            free-text search shell + send
      p[data-lazy-status]             role="status" aria-live="polite"
      div[data-lazy-chips]            suggestion chips
    section[data-lazy-results]        hidden until first response
      div[data-lazy-messages]         aria-live="polite"
      div[data-lazy-products]         product cards
```

## Element identity

Every interactive element is found by data attribute, never by class — `[data-lazy-global-start]`, `[data-lazy-shopify-start]`, `[data-lazy-art-start]`, `[data-lazy-image-upload]`, `[data-quiz-*]`. Restyling cannot break behavior.

Ids that must be unique per instance are suffixed with `{{ block.id }}`: the root `lazy-home-{{ block.id }}`, the upload input, and the search input.

## The quiz

Six fields, all optional at the DOM level: name (max 60), age (number 0–120), audience (man/woman/child), season (summer/fall/winter/spring), product type (nine options including `baby` and `other`), design type (text-only / image-only / text-on-image).

`lazy-home.js` clamps on submit: name trimmed to 60 characters, age parsed and clamped into 0–120 or null. The server applies its own validation — see `32_SHOPIFY_BACKEND_CONTRACT.md`.

## Suggestion chips

`initialSuggestions` carries five entries. The first two carry an `intent` and route through the starter path identically to the buttons; the rest are plain prompts or the `art` action:

| Label | Behavior |
| --- | --- |
| Global fulfillment | `intent: 'global_fulfillment'` |
| Shopify | `intent: 'shopify_catalog'` |
| Find a thoughtful gift | prompt only |
| Something cozy | prompt only |
| Create custom art | `action: "art"` — enters artwork mode |

After a `global_fulfillment` turn the chips reset to `initialSuggestions` rather than to prompt-derived suggestions, so the Shopify alternative stays one click away.

## Accessibility

Live regions on the status paragraph and the message container. `.lazy-home__sr-only` hides the search label and the upload input visually while keeping them available to assistive technology. Decorative SVGs carry `aria-hidden="true"`.
