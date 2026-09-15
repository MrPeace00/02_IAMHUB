# UI — chat bubble widget

> **Corpus source:** `MrPeace00/02_IAMHUB` `main` @ `ac7b8c8` (verified global fulfillment), merged to branch `claude/sharp-franklin-4q9u8d` @ `7698b92`. Captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `extensions/chat-bubble/blocks/chat-interface.liquid`, `assets/chat.js`, `assets/chat.css`.

## Structure

```
.shop-ai-chat-container
  button.shop-ai-chat-bubble        launcher, aria-label "Open Lazy Chat"
  .shop-ai-chat-window
    .shop-ai-chat-header            brand image + {{ 'chat.title' | t }} + close button
    .shop-ai-chat-messages          message elements appended by JS
    .shop-ai-shopping-start         the two starter buttons + explainer span
    .shop-ai-chat-input             text input + send button (inline SVG paper plane)
```

The block also emits a `viewport` meta with `maximum-scale=1.0, user-scalable=no`. That suppresses pinch-zoom on the whole page, not just the widget — an accessibility cost worth noting.

## Starter buttons

```html
<button type="button" data-shop-ai-global>Global fulfillment</button>
<button type="button" data-shop-ai-shopify>Shopify</button>
```

`chat.js` binds each to `Message.send(chatInput, messagesContainer, intent)` with the matching intent, after setting the input's value to a fixed prompt. It does **not** click the send button; routing the click through `Message.send` is what carries the intent.

## Namespaces

Every widget class is prefixed `shop-ai-` so theme CSS cannot collide with it. Message elements carry `.shop-ai-message` plus `.assistant` or `.user`.

## Initialization guard

`ShopAIChat.init` returns early if `container.dataset.chatInitialized` is set, then sets it. A theme that injects the embed twice therefore gets one working widget rather than two competing ones.

## Busy state

`UI.setBusy(busy)` disables the input, the send button, and both starter buttons together. It is called around backend configuration at startup and around every send. See `21_UX_STATE_AND_FEEDBACK.md`.

## Message rendering

Assistant text accumulates in `element.dataset.rawText` and is rendered once at a message boundary by `Formatting.formatMessageContent`. That function:

1. HTML-escapes `&`, `<`, `>`, `"`, `'` **before** any Markdown processing.
2. Converts Markdown links, rejecting any URL that is not `http(s)://` — a non-matching link renders as its label text only.
3. Renders `#`-prefixed headings as bold paragraphs rather than heading elements.

The escape-first ordering is the reason raw Markdown and injected markup do not reach the DOM.

## Destination buttons

On a `needs_destination` result the widget renders one button per allowed country. Clicking a button re-issues an explicit `global_fulfillment` request carrying that country code via `Message.send(input, container, 'global_fulfillment', code)` — the destination is never guessed. See `24_UX_VERIFIED_FULFILLMENT.md`.
