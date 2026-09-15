# UI — the two customer surfaces

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.

Lazy Chat has exactly two customer-facing surfaces. Both ship inside one Shopify theme app extension, `extensions/chat-bubble/`, and both talk to the same backend.

| | Chat bubble widget | Homepage block |
| --- | --- | --- |
| Block file | `blocks/chat-interface.liquid` | `blocks/lazy-home.liquid` |
| Script | `assets/chat.js` | `assets/lazy-home.js` |
| Stylesheet | `assets/chat.css` | `assets/lazy-home.css` |
| Schema `name` | "AI Chat Assistant" | "Lazy AI home" |
| Schema `target` | `body` — app embed, floats over any page | `section` — placed in the theme editor |
| Where it appears | Any page with the embed enabled | `enabled_on.templates: ["index"]` — homepage only |
| Asset loading | Explicit `asset_url` tags in the block | Declared via schema `stylesheet` / `javascript` keys |

## Shared brand asset

`assets/lazy-chat-hub.png` renders twice in the widget: as the launcher image (48×48) and in the window header (34×34), both with empty `alt` since the surrounding text carries the name.

## Settings a merchant can change

Widget (`chat-interface.liquid` schema):

- `app_url` — the backend origin. Default `https://ai.lazycustoms.com`. Required.
- `chat_bubble_color` — default `#5046e4`, applied inline to the launcher.
- `welcome_message` — default "Heyyy".
- `system_prompt` — select, `standardAssistant` or `enthusiasticAssistant`.

Homepage block (`lazy-home.liquid` schema): `app_url` only.

**Note a real inconsistency:** the widget's schema defines `welcome_message`, but the inline config block hard-codes `welcomeMessage: "Heyyy"` rather than reading `block.settings.welcome_message`. A merchant changing that setting sees no effect. This is in the corpus as written, not a transcription slip.

## How configuration reaches the script

The widget writes a global before loading its script:

```js
window.shopChatConfig = { promptType, welcomeMessage, appUrl };
window.shopId = {{ shop.id }};
```

The homepage block instead uses data attributes on its root element: `data-backend-url`, `data-shop-id`, and a `block.id`-suffixed DOM id so multiple instances cannot collide.

## Localization

`locales/en.default.json` carries `chat.title` ("Lazy Chat"), `chat.inputPlaceholder`, `chat.sendButton`, `chat.closeButton`. The widget uses the `| t` filter for these. The starter button labels, the starter explainer sentence, and every homepage string are hard-coded in the Liquid and are **not** localized.
