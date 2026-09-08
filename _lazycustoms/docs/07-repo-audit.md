# REPO_LAYOUT — VS Code Working Structure

**Purpose:** name every file, state its purpose, and say which are documentation versus code.

---

## Recommended structure

```
lazy-customs/
│
├── README.md                      Entry point. What this repo is, where to start
├── CHAMPION.md                    Assistant instruction — load into Gemini Notebook
│
├── docs/
│   ├── PROJECT_STATE.md           Dated snapshot of verified store state
│   ├── DECISIONS.md               Decision register with decision rules
│   ├── IMPLEMENTATION_LOG.md      Doc checks, test runs, open questions
│   ├── GLOSSARY.md                Term discipline — UCP vs MCP vs Catalog vs Agentic
│   ├── CATALOG_ELIGIBILITY.md     Verified gate list + per-product audit worksheet
│   ├── GEO_PLAYBOOK.md            Generative engine optimization method
│   ├── PRODUCT_DATA_SPEC.md       Metafield schema, controlled vocabularies, templates
│   ├── KNOWLEDGE_BASE.md          FAQ gap worksheet
│   ├── CHAT_AGENT_BUILD.md        Storefront chat agent procedure
│   └── DESIGN_PROMPT_BOT.md       Prompt coach specification
│
├── catalog/                       Product data work (not code)
│   ├── audit/                     Completed per-product audit sheets
│   └── copy/                      Draft descriptions before entering in admin
│
├── tests/
│   ├── catalog-check.sh           search_catalog reachability curl
│   ├── policies-check.sh          search_shop_policies_and_faqs curl
│   └── results/                   Dated raw output. Never overwrite
│
├── theme/                         Liquid overrides for Lazy Customs theme
│   └── templates/
│       └── agents.md.liquid       Custom agent discovery content (optional)
│
├── apps/
│   ├── chat-agent/                Cloned or forked shop-chat-agent
│   └── prompt-coach/              Design prompt bot
│
├── .gitignore                     MUST include .env before first commit
└── .env.example                   Variable names only. Never real values
```

---

## File purposes

### Root

| File | Purpose | Type |
|---|---|---|
| `README.md` | Orientation and reading order | Doc |
| `CHAMPION.md` | Assistant operating instruction. Load into Gemini Notebook. Portable to any assistant | Doc |
| `.gitignore` | Prevents credential leakage. **First file to write** | Config |
| `.env.example` | Documents required variable names with no values | Config |

### `docs/`

All documentation. `PROJECT_STATE.md`, `DECISIONS.md`, and `IMPLEMENTATION_LOG.md` are **living files** — they are expected to change weekly. The rest are reference standards that change rarely.

### `catalog/`

Not code. This is where product copy gets drafted and reviewed **before** entering the Shopify admin. Drafting in a file rather than directly in admin gives version history and lets copy be reviewed against `PRODUCT_DATA_SPEC.md` before it goes live.

### `tests/`

Shell scripts wrapping the curl commands in `IMPLEMENTATION_LOG.md`. Output goes to `tests/results/` with a date in the filename. **Never overwrite a previous result** — the value is in the sequence, which is what demonstrates that a fix worked.

### `theme/`

Liquid template overrides. Optional. Shopify serves `/agents.md`, `/llms.txt`, and `/llms-full.txt` by default with no template required. **[Verified]** Only add a template if the default content is insufficient — check the default first.

### `apps/`

Two separate applications. Do not merge them. The chat agent is a shopping assistant; the prompt coach is a design tool. They may eventually share a widget, but they have different dependencies, different failure modes, and different launch gates.

---

## Non-markdown files to create early

| File | When | Why |
|---|---|---|
| `.gitignore` | **Before first commit** | An API key in git history is compromised permanently. Deleting the file does not remove it from history |
| `.env.example` | With `.gitignore` | Documents what is needed without exposing values |
| `tests/catalog-check.sh` | Now | Repeatable. A test run by hand each time gets run inconsistently |
| `tests/policies-check.sh` | After Knowledge Base work | Same |

### `.gitignore` minimum

```
.env
.env.local
node_modules/
.shopify/
dist/
build/
*.log
```

### `.env.example`

```
ANTHROPIC_API_KEY=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOP_DOMAIN=lazy-customs-2.myshopify.com
PRINTIFY_API_TOKEN=
```

Names only. Never commit real values.

---

## Git discipline

1. `git init` and write `.gitignore` **before** anything else.
2. Commit documentation changes separately from code changes.
3. When updating `PROJECT_STATE.md`, put the date in the commit message.
4. Never force-push over history containing a credential — rotate the credential instead.

---

## Suggested VS Code extensions

| Extension | Reason |
|---|---|
| Shopify Liquid | Syntax for theme templates |
| Markdown All in One | Table of contents, table formatting |
| markdownlint | Consistency across a docs-heavy repo |
| Shopify AI Toolkit plugin | Live schema and doc access — see `CHAT_AGENT_BUILD.md` §4 |

---

## Reading order for a new session

1. `README.md`
2. `docs/PROJECT_STATE.md` — what is true today
3. `docs/DECISIONS.md` — what is unresolved
4. `docs/IMPLEMENTATION_LOG.md` — what has been checked and when

Those four re-establish full context. Everything else is reference.
