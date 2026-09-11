# Railway production deployment

The application is prepared for one Railway service using the repository's
`shop-chat-agent-main` directory as its root.

## 1. Create the service

1. Create a Railway Hobby project from the Git repository.
2. Set the service root directory to `/shop-chat-agent-main`.
3. Let Railway build the checked-in `Dockerfile`.
4. Attach a persistent volume at `/data`. The production SQLite database is
   stored at `/data/dev.db`.

Keep the service at one replica while it uses SQLite. Move to Postgres before
adding replicas.

## 2. Configure secrets and runtime values

Copy the variable names from `.env.example` into Railway and provide real
values. At minimum the service needs:

- `AI_TEXT_PROVIDER=anthropic` to use Claude for Lazy Chat text
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_CHAT_MODEL=claude-sonnet-5` (optional; this is the default)
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL=gpt-5.6` (optional; used when `AI_TEXT_PROVIDER=openai`)
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL=https://ai.lazycustoms.com`
- `SCOPES=unauthenticated_read_product_listings`
- `DATABASE_URL=file:/data/dev.db`
- `RATE_LIMIT_SECRET` with a long random value
- `ALLOWED_ORIGINS=https://lazycustoms.com,https://www.lazycustoms.com,https://lazy-customs-2.myshopify.com,https://vbw9zu-f7.myshopify.com`

The default limits allow three image generations per browser session and ten
per source IP per hour. Override `IMAGE_SESSION_LIMIT`, `IMAGE_IP_LIMIT`, or
`IMAGE_RATE_WINDOW_SECONDS` only after reviewing actual usage.

## 3. Point the stable production hostname

1. Add `ai.lazycustoms.com` as the Railway service custom domain.
2. Create the DNS record Railway displays and wait for its certificate to be
   active.
3. Confirm `https://ai.lazycustoms.com/chat?health=true` returns the service
   health response.

The Shopify app configuration and theme-block schema defaults use that stable
hostname. Existing merchant theme settings are not overwritten by a new schema
default, so confirm the active block setting in the theme editor. Do not release
the Shopify configuration before DNS and TLS work.

## 4. Release to Shopify

1. Run `shopify app deploy` from `shop-chat-agent-main` after the Railway health
   check passes.
2. In the theme editor, add **Lazy AI home** to the homepage in a new Apps
   section.
3. Remove or hide other homepage content when the desired result is the blank
   canvas layout.
4. Keep the existing **AI Chat Assistant** app embed enabled if a floating chat
   bubble is also wanted on non-homepage pages.
5. Save the theme and verify product search, ambiguous-intent follow-up, custom
   artwork preview, PNG download, and the Printify personalization upload.
