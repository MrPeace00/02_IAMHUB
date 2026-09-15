# Shopify frontend — theme integration

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `extensions/chat-bubble/`, `shopify.app.toml`, `shopify.web.toml`.

## Extension type

One theme app extension, `chat-bubble`, containing two blocks with different targets:

- `chat-interface.liquid` — `"target": "body"`. An **app embed**: the merchant toggles it in Online Store → Themes → Customize → App embeds. It is off by default; the project record notes that discovering this was what made the bubble appear at all.
- `lazy-home.liquid` — `"target": "section"`, `enabled_on.templates: ["index"]`. The merchant places it on the homepage like any section.

## Asset delivery

The widget block loads its own assets explicitly:

```liquid
{{ 'chat.css' | asset_url | stylesheet_tag }}
<script src="{{ 'chat.js' | asset_url }}" defer></script>
```

The homepage block instead declares them in its schema (`"stylesheet": "lazy-home.css"`, `"javascript": "lazy-home.js"`), letting Shopify handle inclusion.

**Known diagnostic:** the project record notes Shopify reporting `lazy-home.js` at 22,844 bytes against a 10,000-byte asset-size guidance figure. It is a warning, not a release failure — releases have succeeded with it present.

## Backend origin

Both blocks expose an `app_url` setting defaulting to `https://ai.lazycustoms.com`. The widget passes it via `window.shopChatConfig.appUrl`; the homepage block via `data-backend-url`.

The client validates and normalizes this before use and **never falls back to localhost** — a missing or invalid backend produces a disabled chat with "Chat is temporarily unavailable", not a silent request to the wrong host. Covered by `tests/widget-backend.test.mjs`.

## Shop identity

`window.shopId = {{ shop.id }}` in the widget, `data-shop-id` on the homepage block. The client forwards it as the `X-Shopify-Shop-Id` request header, which the CORS allowlist permits.

## Dev vs production stores

The project record distinguishes production `lazycustoms.com` (admin handle `lazy-customs-2`, backing host `vbw9zu-f7.myshopify.com`) from the dev store `lazy-customs-chat-agent.myshopify.com`. The dev store is password-protected and exposes only `search_shop_policies_and_faqs` over MCP — no catalog search. The dev store is correctly **absent** from both the CORS allowlist and the customer-URL allowlist.
