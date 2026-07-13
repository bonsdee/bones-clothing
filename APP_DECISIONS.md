# APP_DECISIONS

## Store concept: Bones Clothing

Bones Clothing is a fictional local streetwear label — small-batch drops, cut and screen-printed by two print shops within walking distance of the "studio." The brand identity leans into that scarcity and locality: numbered drops (Drop 004 — Grayscale), a countdown-driven homepage hero, an editorial "Neighborhood Issue" section that tells the origin story instead of just listing products, and dark/high-contrast branding (near-black background, a single loud accent yellow) that reads as streetwear rather than generic e-commerce.

The standout feature is the **Fit Builder**: a merchant configures "slots" (Tee, Hoodie, Bottoms, Accessory), each backed by a collection. Shoppers pick one item per slot, watch a running subtotal update live, and unlock an automatic bundle discount once every slot is filled — a pattern lifted from how streetwear brands actually upsell ("cop the fit") rather than a generic "frequently bought together" widget. It adds every selected variant to the cart in one request and applies the merchant's matching discount code via Shopify's native `/discount/:code` redirect, so it works without any backend of its own.

## App idea: Drop & Restock Manager

Limited-drop streetwear brands live and die by inventory timing: sell out too early and you're leaving demand (and revenue) on the table with no idea which size to reorder; restock the wrong thing and you eat markdowns on what's left. The recurring, meaningful problem this app solves is: **when something sells out, who wants it back, and what should be restocked first?**

The app lets a merchant:
1. Group products into a **Drop** (a named window of time with its own waitlist and low-stock settings).
2. Let sold-out shoppers join a **waitlist** from the storefront (via the theme's `restock-notify.liquid` section, wired through a Shopify App Proxy).
3. See a computed **Restock Priority Score** per product — not just "what sold out" but "what's actually in demand right now" — so restock decisions are ranked instead of guessed.
4. Track everything that happened (drop created, waitlist signup, inventory alert) in an **activity log**, because "why did we restock X and not Y" is a question merchants actually get asked.

This is deliberately not a CRUD wrapper around a `drops` table. The product thinking is in the scoring model and in tying three data sources (waitlist demand, sell-through rate, recency) into one number a merchant can act on without doing spreadsheet math.

## Key architecture/schema decisions

**Nine related tables, not a flat schema.** `shops` / `sessions` handle multi-tenant auth; `products` / `product_variants` are a local cache of Shopify's catalog (so drop-building doesn't hit the Admin API on every keystroke); `drops` / `drop_products` model the many-to-many between drops and products, with `drop_products.baseline_inventory` captured at drop-creation time specifically so sell-through rate has a stable denominator even as stock depletes; `waitlist_entries` and `activity_logs` are append-mostly logs; `restock_scores` stores a timestamped snapshot every time a score is computed, which turns a single number into a trend line for free (a "improve with more time" item below leverages this).

**Custom Drizzle `SessionStorage` adapter (`db/sessionStorage.js`) instead of the default memory/SQLite session storage.** The `@shopify/shopify-api` SDK's session interface is small (store/load/delete/find-by-shop) but production apps need it durable and queryable, so it's backed by the same MySQL database as everything else rather than a second storage system. It also keeps `shops.access_token` in sync as a convenience column, since most of the app's own logic (product sync, activity logging) wants "the token for this shop" without decoding a session payload.

**Token Exchange over classic OAuth redirects for embedded API calls.** `middleware/verifyRequest.js` verifies the App Bridge session token on every `/api/*` call and exchanges it for an offline access token on first use, rather than bouncing the merchant through `/auth` inside the iframe. Classic OAuth (`routes/auth.js`) is kept only for the initial install redirect, which is where it belongs. This matches Shopify's current recommended embedded-auth pattern and avoids the "embedded app redirects out of the iframe" UX papercut that older OAuth-only implementations have.

**Scoring is computed on read, not purely cached.** `services/scoring.js` recalculates a product's score from current data on every dashboard/drop-detail request (a handful of indexed aggregate queries) and persists the result to `restock_scores` as a side effect, rather than trusting a stale cached value. For this data volume (a boutique brand's catalog, not an enterprise one) that trade favors correctness over the marginal latency cost, while still building the history table the cache-first approach would need anyway.

**Explicit "Sync Catalog" action instead of a background poller.** Product/variant data is pulled from Shopify's Admin GraphQL API on a merchant-triggered button press (`POST /api/products/sync`), logged like any other action. A polling job would keep data fresher automatically, but for a v1 it's simpler, cheaper, and more debuggable to make sync a visible, loggable action — and it's what the create/update workflow actually needs (you sync, then build a drop from what you just pulled).

**App Proxy for the storefront-to-app connection, not a public unauthenticated endpoint.** The theme's waitlist form posts to `/apps/drop-waitlist/subscribe`, which Shopify proxies to the app with a signed `signature` query param that `routes/proxy.js` verifies via HMAC before trusting the request. This keeps the app's database reachable from the storefront without exposing an open API or shipping any app secret to the browser.

## Tradeoffs

- **MySQL over a managed session/queue service.** Everything (sessions, products, drops, activity, scores) lives in one MySQL database for a single, simple deployment story appropriate for a take-home. A production app at scale would likely split hot session-token traffic onto Redis and keep MySQL for the durable domain data.
- **Sell-through and "days since sold out" use proxies, not first-class events.** `daysSinceSoldOut` is inferred from the most recent waitlist signup timestamp rather than a dedicated `soldOutAt` column set the instant inventory hits zero, because that requires a webhook-driven inventory pipeline beyond this scope. It's flagged in code comments as an approximation.
- **No background job runner.** Restock scores recompute synchronously on request rather than via a scheduled worker, which is simpler to reason about and test but wouldn't scale to a very large catalog without pagination/batching.
- **Manual sync over real-time webhook-driven inventory sync.** `inventory_levels/update` webhooks are logged for audit purposes but don't yet write directly into `product_variants` (see schema comment in `services/webhooks.js`) — full reconciliation happens on the next manual sync. A production version would map `inventory_item_id` to variants during sync and update stock levels from the webhook payload directly.
- **Discount application in the theme relies on merchant-configured discount codes**, not a Shopify Function or Script that computes the bundle price server-side. This keeps the Fit Builder framework-free and app-independent, but means the discount has to be created and named correctly by the merchant (documented in the README) rather than being fully automatic.

## What I'd improve with more time

1. **Wire `inventory_levels/update` webhooks all the way through** to update `product_variants.inventory_quantity` directly (mapping `inventory_item_id` → variant during sync), so low-stock alerts and scores react in real time instead of waiting for the next manual sync.
2. **A Shopify Function for the Fit Builder bundle discount**, replacing the "merchant creates a matching discount code" convention with an automatic, server-computed price break — removes a manual setup step and a class of misconfiguration.
3. **Score trend charts** on the dashboard using the `restock_scores` history table that's already being written to but not yet visualized — "this product's urgency has climbed 40 points in three days" is a stronger signal than a static number.
4. **Scheduled/automatic restock email** when a merchant marks a product "restocked," using the `waitlist_entries.notified_at` bulk-notify instead of one-by-one, plus an actual transactional email provider rather than the current manual "Mark Notified" button.
5. **Multi-location inventory awareness** — the current schema sums variant inventory across all locations; a merchant with multiple warehouses would want location-scoped low-stock alerts.
6. **Automated tests** (the scoring logic in particular is prime unit-test territory) and a seed script for demo data, beyond the manual seed/verification script used during development.
