# KNOWLEDGE_BASE — FAQ Gap Worksheet

**Status:** 5 auto-generated FAQs present · **7 topics flagged and unanswered** · 0 AI-agent queries logged. **[Project Record — admin observation, 2026-09-02]**

---

## Why this is engineering work, not housekeeping

The Storefront MCP endpoint exposes `search_shop_policies_and_faqs`. **[Verified]**

When an agent is asked "what's their return policy on baby items," this is the response body. An unanswered topic is an **empty API response**, not a blank web page. The agent cannot infer. It either has the answer or it recommends someone else.

Zero logged agent queries is expected and not a signal — the store is password-protected, so no agent has been able to reach it. **[Inference]**

---

## Answer standard

| Rule | Reason |
|---|---|
| State the actual policy, with numbers | "We aim to ship quickly" is unextractable. "Orders ship in 2–3 business days" is an answer |
| One topic per answer | Agents retrieve by topic match |
| Do not hedge into meaninglessness | Hedged answers cause the agent to omit you rather than misquote you |
| Must match Settings > Policies exactly | A contradiction between FAQ and policy page is worse than a gap |
| Only state what is true | An invented shipping window becomes a customer dispute |

---

## The seven gaps

Fill each. Where the answer is not yet decided, that is a **business decision to make**, not a writing task to postpone — record it in `DECISIONS.md`.

```
TOPIC 1: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

```
TOPIC 2: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

```
TOPIC 3: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

```
TOPIC 4: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

```
TOPIC 5: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

```
TOPIC 6: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

```
TOPIC 7: ________________________________
Answer:

Matches policy page? [ ] yes  [ ] n/a
Date written: __________
```

---

## Topics to cover regardless of what Shopify flagged

For a print-on-demand baby/nursery store, these are the questions agents will actually be asked:

- Shipping time — **production time plus transit**, stated separately. POD production time is the single most common customer surprise
- Which countries you ship to
- Return window and whether custom/personalized items are returnable
- Who pays return shipping
- Sizing guidance and how to choose between age ranges
- Material and washing instructions at the store level
- Whether items are made to order (this affects both returns and expectations)
- How to contact a human

**POD-specific caution:** if fulfillment runs through Printify and Tapstitch with different production times, the honest answer is a range covering both, or separate answers per product line. A single optimistic number that only one supplier meets will generate disputes.

---

## Verification

Once the store is public, query the endpoint directly:

```bash
curl -s https://lazy-customs-2.myshopify.com/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,
       "params":{"name":"search_shop_policies_and_faqs",
                 "arguments":{"query":"return policy"}}}'
```

Record output in `IMPLEMENTATION_LOG.md`. If the response is thin, that is what every agent sees.
