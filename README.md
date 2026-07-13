# Bones Clothing — Shopify Theme + Drop & Restock Manager

A two-part Shopify build: **Bones Clothing**, a custom Online Store 2.0 theme for a fictional local streetwear label built around limited "drops" — and **Drop & Restock Manager**, an embedded Admin app that answers the question every drop-based brand has the morning after a sellout: *who wants this back, and what should we restock first?*

The two halves are designed to work together: the theme's sold-out waitlist form feeds real demand data into the app through a Shopify App Proxy, and the app turns that demand into a ranked restock priority score.

> Full concept writeup, architecture rationale, and tradeoffs: **[APP_DECISIONS.md](./APP_DECISIONS.md)**

---

## What's inside

```
theme/            Shopify OS 2.0 Liquid theme — dark/gold streetwear branding
app/
  server/         Node.js + Express — OAuth + token exchange, REST API, webhooks,
                  App Proxy endpoint, Drizzle ORM over MySQL (9 related tables)
  client/         Vite + React + Polaris — embedded Admin UI (App Bridge)
APP_DECISIONS.md  Concept, schema decisions, tradeoffs, roadmap
```

### Theme highlights

- **4 core pages** — Home, Collection (with filtering + sorting), Product, Cart (AJAX quantity updates + slide-out cart drawer), plus custom Collections-index and Search pages.
- **7 custom sections** — Hero Drop (countdown timer), Fit Builder, Lookbook Editorial, Collection Banner, Collection List, Restock Notify, and a styled Search — all schema-driven and editable in the theme customizer.
- **Standout feature: the Fit Builder.** Merchants configure "slots" (Tee, Hoodie…), each backed by a collection. Shoppers pick one item per slot, watch a live subtotal, and unlock an automatic bundle discount when every slot is filled — the whole fit is added to the cart in a single request. Vanilla JS, no framework, no backend dependency.
- **Theme → app integration.** On sold-out products, the Restock Notify section posts to `/apps/drop-waitlist/subscribe`; Shopify's App Proxy forwards it (HMAC-signed) to the app, which records a real waitlist entry.
- Minimal JavaScript throughout: four small vanilla JS files, no build step.

### App highlights

- **Embedded auth done the current way** — classic OAuth for install only; every embedded API call is authenticated via an App Bridge session token verified server-side and exchanged for an offline token (no redirect loops inside the iframe).
- **Dashboard** — active drops, waitlist totals, catalog size, and a live-ranked Restock Priority list.
- **Create/update workflow** — build a drop from your synced catalog, edit it, and move it through a status lifecycle (draft → scheduled → active → ended). Baseline inventory is captured per product at drop creation so sell-through has a stable denominator.
- **Activity log** — append-only audit trail (drop created/updated, catalog synced, waitlist signups) surfaced in the UI.
- **Logic feature: Restock Priority Score** (0–100, recomputed on read):

  ```
  score = 0.50 × waitlist demand   (normalized against the hottest product in the drop)
        + 0.35 × sell-through rate (units sold vs. baseline inventory at drop start)
        + 0.15 × recency boost     (linear 30-day decay since sellout; neutral if unknown)
  ```

  Weights are deliberately simple and explainable — a merchant deciding what to reorder needs to trust the number, not reverse-engineer a black box. Every computation is also snapshotted to a history table (`restock_scores`), so trend lines come for free later.

---

## Quick start

### Part 1 — Theme

Requirements: a [Shopify development store](https://partners.shopify.com) and [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) v3+ (`npm install -g @shopify/cli`).

```bash
cd theme
shopify theme dev --store your-dev-store.myshopify.com
```

That serves the theme with hot reload at `127.0.0.1:9292`. To upload it to the store's theme library instead: `shopify theme push --store your-dev-store.myshopify.com`.

**Content setup (in Shopify Admin):**

1. Add products, organized into collections matching the Fit Builder slots (the shipped homepage config uses two: `tee` and `hoodie-jacket`).
2. **Online Store → Themes → Customize** to point the Hero Drop button and Fit Builder slot blocks at your collections (or edit `theme/templates/index.json` directly).
3. Set the countdown target in **Theme settings** (`next_drop_iso`, any future ISO timestamp).
4. *(Optional — bundle discount)* Create a discount code named `FITBUNDLE` + slot count (e.g. `FITBUNDLE2` for the default two-slot builder). Without it the fit still adds to cart; only the price break is skipped.
5. *(Optional — waitlist)* Configure the App Proxy in Part 2 so the sold-out "Notify Me" form writes real waitlist rows.

### Part 2 — Embedded app

Requirements: Node 18+, MySQL 8+ (or MariaDB 10.6+), a Shopify Partner app (for API credentials), and a public tunnel for local dev (e.g. `cloudflared tunnel --url http://localhost:5173`).

**1. Database**

```bash
mysql -u root -p -e "CREATE DATABASE drop_restock_manager;"
```

**2. Backend**

```bash
cd app/server
cp .env.example .env    # fill in: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL (tunnel), DATABASE_URL
npm install
npm run db:migrate      # applies src/db/migrations to your database (9 tables)
npm run dev             # Express on :8080
```

**3. Frontend**

```bash
cd app/client
cp .env.example .env    # fill in: SHOPIFY_API_KEY (same Client ID), BACKEND_PORT=8080
npm install
npm run dev             # Vite on :5173 — proxies /api, /auth, and /proxy to the backend
```

**4. Partner Dashboard configuration**

| Setting | Value |
|---|---|
| App URL | `{SHOPIFY_APP_URL}` |
| Allowed redirection URL | `{SHOPIFY_APP_URL}/auth/callback` |
| App proxy | prefix `apps`, subpath `drop-waitlist`, proxy URL `{SHOPIFY_APP_URL}/proxy` |
| Webhooks (API version 2026-07) | `app/uninstalled`, `inventory_levels/update`, `products/update` → `{SHOPIFY_APP_URL}/webhooks` |

**5. Install & first run**

Install via the Partner Dashboard's test-install link (or `{SHOPIFY_APP_URL}/auth?shop=your-store.myshopify.com`), then inside the app:

1. **Drops → New Drop → Sync Catalog from Shopify**, pick products, save.
2. Flip the drop's status to **Active** on its detail page.
3. Trigger a waitlist signup from the storefront on a sold-out product (or insert a row directly).
4. Watch the **Dashboard** re-rank — a single signup on a sold-out item moves that product straight to the top.

**Production build**

```bash
cd app/client && npm run build          # → app/client/dist
cd ../server && NODE_ENV=production npm start   # one process serves API + built frontend
```

> Dev note: opening the Vite URL directly (outside the Shopify Admin iframe) renders a blank shell — expected, since App Bridge needs the `?host=` param the Admin provides. Always enter through the Admin. Quick tunnels also mint a new URL on every restart; update `SHOPIFY_APP_URL` and the three Partner Dashboard URLs together when that happens.

---

## Where to look first (reviewer's guide)

| Area | File(s) |
|---|---|
| Standout theme feature | `theme/sections/fit-builder.liquid` + `theme/assets/fit-builder.js` |
| Theme → app bridge | `theme/sections/restock-notify.liquid` → `app/server/src/routes/proxy.js` (HMAC verification) |
| Scoring engine | `app/server/src/services/scoring.js` |
| Embedded auth | `app/server/src/middleware/verifyRequest.js` (session token → token exchange) |
| Schema (9 related tables) | `app/server/src/db/schema.js` + `src/db/migrations/` |
| Custom session storage | `app/server/src/db/sessionStorage.js` (Drizzle-backed adapter for `@shopify/shopify-api`) |
| Create/update workflow | `app/client/src/pages/DropForm.jsx` + `app/server/src/routes/api/drops.js` |

---

## Tech stack

**Theme:** Shopify Liquid (OS 2.0 JSON templates + section groups), hand-written CSS, vanilla JS.
**App:** Vite + React + Shopify Polaris + App Bridge · Node.js + Express · Drizzle ORM · MySQL 8 · Shopify Admin GraphQL API · App Proxy + webhooks.
