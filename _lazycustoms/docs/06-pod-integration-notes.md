# DESIGN_PROMPT_BOT — Prompt Coach Specification

**Status: Concept.**

**Objective:** help a customer craft a well-formed prompt to create or recreate a design, usable across Tapstitch and Printify.

---

## 1. This is not Storefront MCP

Storefront MCP covers catalog, cart, and policies. **[Verified]** It has **no design-generation capability**. Nothing in Shopify's agentic stack does what this bot does.

This is a **custom application**. It can share the scaffold in `CHAT_AGENT_BUILD.md`, but it is a distinct function with distinct dependencies.

---

## 2. Three separable functions — do not merge them

| # | Function | Depends on | Cost | Blocked by store password? |
|---|---|---|---|---|
| 1 | **Prompt coaching** — interrogate the customer, produce a well-formed image prompt | LLM only | Low | No |
| 2 | **Image generation** — produce the artwork | Image model | Medium | No |
| 3 | **Design → product** — push artwork onto a blank | POD vendor API | High | No |

**Build order per `DECISIONS.md` D5: 1 → 2 → 3.**

Function 1 alone is genuinely useful, has no vendor dependency, and can be built and tested today.

---

## 3. Vendor capability — the platforms are not symmetric

### Printify — **[Verified]**

Public API documented at `developers.printify.com`.

- Files can be added directly to the media library; image IDs are then used when creating or modifying products. **[Verified]**
- Upload accepts **image URL or base64-encoded contents**. **[Verified]**
- **DPI validation** is a common failure mode — low-quality images are rejected with a detailed error. **[Verified]** Generated artwork must be produced at print resolution, not screen resolution. This constrains function 2.
- Placement rule of thumb: artwork at print-area placeholder width → scale `1.00`, position `x=0.5, y=0.5` fills the area. **[Verified]**
- **Integration cost most people miss:** Printify's "publish" only locks the product on Printify. Creating it on your store is a separate step you build or automate. **[Verified]**

### Tapstitch — **[Unknown]**

No public developer API documentation located as of 2026-09-02.

**Do not assume an API exists because Printify's does.** Verify directly with the vendor before scoping any Tapstitch automation.

If no API exists, the realistic Tapstitch path is: bot produces the prompt and artwork → Mr. Peace places it manually. That is still most of the value.

**Action:** contact Tapstitch. Record the answer in `IMPLEMENTATION_LOG.md`.

---

## 4. Prompt-coach design

The bot's job is to convert a vague wish into a specification. It should elicit, in roughly this order:

1. **Subject** — what is depicted
2. **Style** — illustration, line art, watercolor, typographic, photographic
3. **Color** — palette, and whether it must match a nursery scheme
4. **Composition** — centered, full-bleed, corner placement
5. **Text** — exact wording, exact spelling, and whether text is required at all
6. **Product** — which blank; this determines print area and aspect ratio
7. **Constraints** — print resolution, color count, background transparency

Output a structured prompt plus the print specification, not just prose.

**Recreate mode** additionally needs: what specifically to preserve (subject, palette, composition, mood) and what may change. Without that, "recreate" is undefined.

---

## 5. Policy gate — resolve before launch, not after

A bot that generates customer-directed artwork creates **IP-infringement exposure** the first time a customer requests a copyrighted character, a brand logo, or a celebrity likeness.

This is a policy and moderation problem, not a technical one.

Required before public launch:
- [ ] Written policy on what the bot will and will not generate
- [ ] Refusal behavior implemented in the system prompt **and** enforced server-side
- [ ] Terms-of-use language for customer-submitted designs
- [ ] Escalation path for edge cases

**A refusal in the system prompt alone is not enforcement.** It is a suggestion to a model.

Licensed counsel is required for the final determination on IP liability and customer-submitted-content terms. Champion can prepare the analysis to brief counsel; it cannot make the determination.

---

## 6. Open questions

| Question | Blocking | How to resolve |
|---|---|---|
| Does Tapstitch expose a public API? | Function 3 on Tapstitch | Contact vendor |
| Which image model, at what resolution and cost per generation? | Function 2 | Evaluate against Printify DPI requirements |
| Who pays for generations that never convert? | Unit economics | Model it. An unmetered public image endpoint is a real cost exposure |
| Does the customer own the generated design? | Terms | Counsel |
