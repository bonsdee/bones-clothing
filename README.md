# Bones Clothing — Shopify Theme + Drop & Restock Manager

This repo contains the two deliverables for the take-home:

```
theme/     Shopify Online Store 2.0 Liquid theme — "Bones Clothing", a local streetwear brand
app/       Embedded Shopify Admin app — "Drop & Restock Manager"
  server/  Node.js + Express backend (OAuth, REST API, Drizzle ORM, MySQL)
  client/  Vite + React + Polaris frontend (runs inside the Shopify Admin iframe)
```

See `APP_DECISIONS.md` for the concept writeup, architecture rationale, and tradeoffs.

---

## Part 1 — Theme setup

### Requirements
- A Shopify store (development store is fine — [create one free via Partners](https://partners.shopify.com))
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) v3+: `npm install -g @shopify/cli`

### Run it
```bash
cd theme
shopify theme dev --store your-dev-store.myshopify.com
```
This serves the theme locally with hot reload and gives you a preview URL.

To push it to the store's theme library instead of just previewing:
```bash
shopify theme push --store your-dev-store.myshopify.com
```

### Getting real content into it
The theme ships with sensible defaults but is empty of real products. In the Shopify Admin:
1. Add products, organized into collections that match the Fit Builder slots you want (e.g. a "Tees", "Hoodies", "Bottoms", "Accessories" collection).
2. Go to **Online Store → Themes → Customize** and assign those collections to the Fit Builder section's four slot blocks on the homepage.
3. Set `next_drop_iso` in **Theme settings → Drop settings** to a future ISO timestamp to activate the homepage countdown.
4. (Optional, for the bundle discount) Create a Shopify automatic discount named to match the Fit Builder's `discount_code_prefix` + slot count — e.g. `FITBUNDLE4` for a 15%-off, 4-item bundle — so the "Add Fit to Bag" button's redirect actually applies a price break. Without this discount configured, the fit still adds to cart correctly; only the price reduction is skipped.
5. (Optional, for the waitlist form) Point the theme at a running instance of the app (see Part 2) via an App Proxy — the `restock-notify.liquid` section posts to `/apps/drop-waitlist/subscribe` automatically once that proxy is configured in the Partner Dashboard.

### What to look at first
- `theme/sections/fit-builder.liquid` + `theme/assets/fit-builder.js` — the standout interactive feature.
- `theme/sections/hero-drop.liquid` — drop countdown hero.
- `theme/sections/lookbook-editorial.liquid` — brand storytelling section.
- `theme/sections/restock-notify.liquid` — the theme-to-app integration point.

---

## Part 2 — Embedded app setup

### Requirements
- Node.js 18+
- MySQL 8 or MariaDB 10.6+ (a local install, Docker container, or PlanetScale/RDS all work)
- A Shopify Partner account + app created in the Partner Dashboard (for `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET`)
- A public tunnel for local dev (e.g. `cloudflared tunnel --url http://localhost:8080`, or `shopify app dev` if you adopt the CLI's tunnel)

### 1. Database
```bash
# create the database (adjust for your MySQL setup)
mysql -u root -p -e "CREATE DATABASE drop_restock_manager;"
```

### 2. Backend
```bash
cd app/server
cp .env.example .env
# edit .env: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL (your tunnel URL), DATABASE_URL

npm install
npm run db:migrate     # applies the migration in src/db/migrations to your database
npm run dev             # starts the Express server on PORT (default 8080)
```

`npm run db:generate` re-runs `drizzle-kit generate` if you change `src/db/schema.js` — it diffs the schema against the existing migrations and writes a new incremental SQL file, it does not need a live DB connection to do this.

### 3. Frontend
```bash
cd app/client
cp .env.example .env
# edit .env: SHOPIFY_API_KEY (same Client ID as the backend), BACKEND_PORT

npm install
npm run dev              # Vite dev server on :5173, proxies /api and /auth to the backend
```

For local development, open the app through Shopify's app preview URL (Partner Dashboard → your app → "Test your app on a development store"), which appends the `?shop=` and `?host=` params App Bridge needs. Running `npm run dev` on its own with no query params will render a blank shell — that's expected outside the iframe.

### 4. Partner Dashboard configuration
In your app's settings:
- **App URL**: your tunnel URL (matches `SHOPIFY_APP_URL`)
- **Allowed redirection URL(s)**: `{SHOPIFY_APP_URL}/auth/callback`
- **App proxy**: subpath prefix `apps`, subpath `drop-waitlist`, proxy URL `{SHOPIFY_APP_URL}/proxy` — this is what lets the theme's "Notify Me" form write real waitlist rows.
- **Webhooks** (or declare them in `shopify.app.toml` and let `shopify app deploy` register them): `app/uninstalled`, `inventory_levels/update`, `products/update`, all pointing at `{SHOPIFY_APP_URL}/webhooks`.

### 5. Install on a dev store
Visit `{SHOPIFY_APP_URL}/auth?shop=your-dev-store.myshopify.com` to kick off OAuth, or use the Partner Dashboard's install link. After install you'll land back in the embedded app.

### 6. First run inside the app
1. **Drops → New Drop** → click **Sync Catalog from Shopify** to pull your products in, then select which ones belong to the drop and save.
2. Set the drop's status to **Active** from the drop detail page.
3. Trigger a couple of waitlist signups from the storefront (Part 1) on a sold-out variant, or insert rows directly for a quick demo.
4. Back in the app, **Dashboard** and the drop's detail page show the live Restock Priority ranking recalculating from that data.

### Production build
```bash
cd app/client && npm run build   # writes app/client/dist
cd ../server && NODE_ENV=production npm start   # serves the built frontend + API from one process
```

---

## Verifying the database layer without a real Shopify store

Everything in `app/server/src/db` and `src/services/scoring.js` was validated directly against a real MySQL instance during development (migrations applied cleanly, foreign keys enforced, and the scoring algorithm was exercised against seeded rows) — see `APP_DECISIONS.md` for what was and wasn't feasible to test without a live Shopify store/tunnel.
