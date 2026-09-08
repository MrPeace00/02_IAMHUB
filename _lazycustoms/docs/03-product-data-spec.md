# PRODUCT_DATA_SPEC — Lazy Customs

**Version:** 1.0 · **2026-09-02**
**Purpose:** one consistent structure so every product presents the same extractable attributes.

Consistency is the whole point. A field populated on some products and not others is worse than useless — it teaches the normalizer that the field is unreliable. **[Inference]**

---

## Field standard

| Field | Where it lives | Required | Rule |
|---|---|---|---|
| Title | Product title | Yes | Specific noun phrase. Include material + item type. No slogans, no ALL CAPS, no emoji |
| Category | Shopify taxonomy | Yes | Set one clean primary category and let taxonomy handle the rest |
| Description | Body | Yes | Written as an answer. Lead with what it is, who it fits, what it's made of, how it's cared for |
| Price | Price | Yes | Must be > 0 **[Verified requirement]** |
| Images | Media | Yes, ≥1 | **[Verified requirement]**. Prefer a plain-background primary shot plus in-use shots |
| Material | Metafield | Yes | Fiber content with percentages. Certification names only if actually held |
| Age range | Metafield | Yes (baby line) | Months, e.g. `6-12 months`. Highest-value attribute in this category |
| Dimensions | Metafield | Yes | Number + unit, consistent unit system throughout |
| Color | Product option | Yes | Controlled vocabulary — see below |
| Size | Product option | Where applicable | Controlled vocabulary |
| Care | Metafield | Yes | `Machine wash cold, tumble dry low` style |
| Intended use | Metafield or description | Yes | One sentence answering a real buyer question |
| Safety certification | Metafield | Only if held | **Never populate speculatively** |

---

## Controlled vocabularies

Pick one term per concept and never vary it.

**Color** — one word per color, lowercase, no marketing names.
`natural` `cream` `sage` `navy` `blush` `grey` `white` `terracotta`
Never mix `navy` and `royal blue` as separate values for the same shade. **[Tier 2]**

**Size** — one convention per product type. Never mix `XL` and `X-Large` in the same catalog.

**Age** — always months for under-24, then years. `0-3 months` · `6-12 months` · `2-3 years`

**Units** — pick imperial or metric as primary and apply it everywhere. Mixed units break comparison.

---

## Description template

```
[Item type] in [material], sized for [audience/age range].

[One sentence answering the primary buyer question — what problem does it solve?]

Material: [fiber content with percentages]
Dimensions: [number + unit]
Care: [washing instructions]
[Certification, only if held]
```

**Worked example — Baby Sleep Sack**

> Wearable sleep sack in organic cotton, sized for 6–12 months.
>
> Replaces loose blankets in the crib, with a two-way zip for nighttime changes without fully undressing baby.
>
> Material: 100% GOTS-certified organic cotton *(populate only if the certification is actually held)*
> Dimensions: 26 in length, chest 11 in flat
> Care: Machine wash cold, tumble dry low
> TOG rating: 1.0

Note how many extractable attributes that contains versus "cozy and adorable for your little one." That difference is the entire GEO thesis.

---

## Naming convention for product handles

`lowercase-hyphenated-descriptive`. Include the material or defining attribute.

Good: `organic-cotton-sleep-sack-6-12m`
Weak: `product-4` · `sleep-sack-new-v2-FINAL`

The handle becomes part of the product URL, which is itself a verified eligibility requirement. **[Verified]**

---

## Audit query

Before publishing, for every product ask: **could an agent answer "does this fit a 9-month-old and is it machine washable?" using only the structured record — without reading marketing prose?**

If no, the record is incomplete regardless of how good the copy reads.
