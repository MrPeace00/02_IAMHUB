# 02_IAMHUB

Claude-readable folder and file structure.

```text
02_IAMHUB/
├── _lazycustoms/
│   ├── chat-agent-additions/
│   │   ├── prompts/
│   │   │   ├── guardrails.md
│   │   │   ├── system-design-coach.md
│   │   │   └── system-shopping.md
│   │   ├── .env.example
│   │   └── NOTES.md
│   ├── docs/
│   │   ├── 00-decision-log.md
│   │   ├── 01-ucp-implementation-log.md
│   │   ├── 02-catalog-eligibility-audit.md
│   │   ├── 03-product-data-spec.md
│   │   ├── 04-knowledge-base-answers.md
│   │   ├── 05-architecture.md
│   │   ├── 06-pod-integration-notes.md
│   │   └── 07-repo-audit.md
│   ├── ops/
│   │   ├── audit_repo.py
│   │   ├── check_catalog.py
│   │   ├── check_discovery.py
│   │   └── README.md
│   ├── FOLDER_STRUCTURE.md
│   └── README.md
└── shop-chat-agent-main/
    ├── .cursor/
    │   └── mcp.json
    ├── .vscode/
    │   └── extensions.json
    ├── app/
    │   ├── prompts/
    │   │   └── prompts.json
    │   ├── routes/
    │   │   ├── _index/
    │   │   │   ├── route.jsx
    │   │   │   └── styles.module.css
    │   │   ├── api.webhooks.jsx
    │   │   ├── app._index.jsx
    │   │   ├── app.jsx
    │   │   ├── auth.$.jsx
    │   │   ├── auth.callback.jsx
    │   │   ├── auth.token-status.jsx
    │   │   └── chat.jsx
    │   ├── services/
    │   │   ├── claude.server.js
    │   │   ├── config.server.js
    │   │   ├── streaming.server.js
    │   │   └── tool.server.js
    │   ├── auth.server.js
    │   ├── db.server.js
    │   ├── entry.server.jsx
    │   ├── mcp-client.js
    │   ├── root.jsx
    │   ├── routes.js
    │   └── shopify.server.js
    ├── extensions/
    │   ├── chat-bubble/
    │   │   ├── assets/
    │   │   │   ├── chat.css
    │   │   │   └── chat.js
    │   │   ├── blocks/
    │   │   │   └── chat-interface.liquid
    │   │   ├── locales/
    │   │   │   └── en.default.json
    │   │   └── shopify.extension.toml
    │   └── .gitkeep
    ├── prisma/
    │   ├── migrations/
    │   │   ├── 20240530213853_create_session_table/
    │   │   │   └── migration.sql
    │   │   ├── 20250501044923_add_customer_tokens_table/
    │   │   │   └── migration.sql
    │   │   ├── 20250502141909_add_code_verifier_table/
    │   │   │   └── migration.sql
    │   │   ├── 20250508000001_add_conversation_tables/
    │   │   │   └── migration.sql
    │   │   ├── 20251010121648_add_customer_account_urls_table/
    │   │   │   └── migration.sql
    │   │   └── migration_lock.toml
    │   └── schema.prisma
    ├── public/
    │   └── favicon.ico
    ├── .dockerignore
    ├── .editorconfig
    ├── .eslintignore
    ├── .eslintrc.cjs
    ├── .gitignore
    ├── .graphqlrc.js
    ├── .mcp.json
    ├── .npmrc
    ├── .prettierignore
    ├── CHANGELOG.md
    ├── Dockerfile
    ├── LICENSE.md
    ├── package.json
    ├── shopify.app.toml
    ├── shopify.web.toml
    ├── tsconfig.json
    └── vite.config.js
```

Excluded from this tree: `.git`, `node_modules`, build/cache directories, `.env*` files, and local SQLite database files.
