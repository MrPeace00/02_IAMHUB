# UX — state, feedback, and failure

> **Corpus source:** `MrPeace00/02_IAMHUB`, branch `claude/sharp-franklin-4q9u8d`, commit `fc30960`, captured 2026-09-15.
> Project record (Engine §2.1 tier 3). A snapshot, not the deployed state.
Files: `assets/chat.js`, `assets/lazy-home.js`, `app/services/streaming.server.js`.

## Request locking

`Message.send` returns immediately if the message is empty, if `this.busy` is set, or if the input is disabled. Otherwise it sets `busy`, calls `UI.setBusy(true)`, and restores both in a `finally` block — so a rejected request unlocks the UI just as a successful one does.

`setBusy` disables the text input, the send button, **and both starter buttons** together. A customer cannot fire a second starter while the first is streaming.

The homepage block has the equivalent `busy` flag guarding its own handlers.

## Typing indicator

`showTypingIndicator` returns early if an indicator already exists, so repeated `tool_use` events cannot stack duplicates. `removeTypingIndicator` runs both on `message_complete` and in the `finally` of `send`.

## Buffered rendering

Assistant text is accumulated into `dataset.rawText` while the element stays `hidden`. It is formatted and revealed once, at `message_complete` or `new_message`. Consequences:

- Partial Markdown never appears on screen.
- The message does not scroll on every token; `scrollToBottom` runs at boundaries.
- If the connection closes without `message_complete`, a post-loop check formats and reveals whatever arrived, and keeps the element hidden only if it is genuinely empty.

## SSE events the client handles

| Event | Effect |
| --- | --- |
| `id` | Stores `conversation_id` in `sessionStorage`. |
| `starter_result` | Records `intent` and `state` on the element's dataset. |
| `chunk` | Appends to `rawText`. No visible change. |
| `message_complete` | Format, reveal, scroll. |
| `product_results` | Render cards. Suppressed when the intent is `global_fulfillment` and the array is empty. |
| `new_message` | Finalize current element, show indicator, start a new element. |
| `tool_use` | Show the typing indicator. |
| `error`, `rate_limit_exceeded` | Replace the element with a fixed sentence, clear `rawText`, reveal. |
| `auth_required` | Handled by the widget's auth path. |
| `end_turn` | Stream ends. |

## Error message discipline

Client-visible failure text is fixed and generic: "Sorry, I couldn't process your request. Please try again later." and, for rate limits, "Sorry, our servers are currently busy. Please try again later." Clearing `rawText` on error prevents a half-streamed answer from being revealed alongside the error.

On the server, `handleStreamingError` classifies by status: 401 or an auth/key message becomes an authentication error, 429 or a rate-limit message becomes `rate_limit_exceeded`, everything else becomes a generic provider failure.

**A real gap:** the `POST /chat` catch block returns a generic body but no longer logs server-side. A 500 there leaves no diagnostic trace.
