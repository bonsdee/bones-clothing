# 🦴 Bones Clothing — Shopify Theme + Drop & Restock Manager

A two-part Shopify project built with **Liquid**, **Vite + React**, **Node.js**, and **Drizzle ORM + MySQL**. A custom streetwear storefront theme, plus an embedded Admin app that tells merchants **what to restock first** after a drop sells out.

📄 Full concept, architecture decisions, and tradeoffs: [APP_DECISIONS.md](./APP_DECISIONS.md)

---

## 🚀 Features

### 🎨 Theme — "Bones Clothing"

- 🏠 Home, Collection, Product, and Cart pages (plus custom Search & Collections pages)
- ⏳ Hero section with live drop countdown timer
- 🧢 **Fit Builder** — pick one item per category, live subtotal, auto bundle discount
- 🛒 AJAX cart drawer with live quantity updates
- 📧 "Notify Me" waitlist form on sold-out products (connects to the app)
- 🖤 Dark/gold streetwear branding, custom logo, 7 custom sections
- ⚡ Vanilla JS only — no frameworks, no build step

### 📊 App — "Drop & Restock Manager"

- 🔐 Shopify OAuth + embedded App Bridge session auth
- 📈 Dashboard — active drops, waitlist totals, restock priority ranking
- 📦 Create & update Drops from your synced product catalog
- 🔄 One-click "Sync Catalog from Shopify"
- 📝 Activity log of every action (drops, syncs, signups)
- 🧮 **Restock Priority Score (0–100)** — ranks products by waitlist demand + sell-through + recency
- 🔗 App Proxy endpoint that receives storefront waitlist signups (HMAC verified)

---

## 🛠 Tech Stack

### Frontend
- Vite
- React
- Shopify Polaris
- Shopify App Bridge

### Backend
- Node.js
- Express
- Shopify Admin GraphQL API
- Webhooks + App Proxy

### Database
- MySQL 8
- Drizzle ORM (9 related tables + migrations)

### Theme
- Shopify Liquid (Online Store 2.0)
- CSS
- Vanilla JavaScript

---

## 📁 Project Structure

```
theme/            Shopify theme (Liquid + CSS + JS)
app/
  server/         Express backend (OAuth, API, Drizzle, MySQL)
  client/         Vite + React embedded Admin UI
APP_DECISIONS.md  Concept & architecture writeup
```

---

## ⚙️ Setup

### 1️⃣ Theme

```bash
cd theme
shopify theme dev --store your-dev-store.myshopify.com
```

Then in Shopify Admin: add products to collections (e.g. `tee`, `hoodie-jacket`) and assign them to the Fit Builder slots in the theme editor.

💡 Optional: create a discount code `FITBUNDLE2` (15% off) so the Fit Builder bundle discount applies.

### 2️⃣ Database

```bash
mysql -u root -p -e "CREATE DATABASE drop_restock_manager;"
```

### 3️⃣ Backend

```bash
cd app/server
cp .env.example .env    # add your Shopify API keys, tunnel URL, DB connection
npm install
npm run db:migrate
npm run dev             # runs on :8080
```

### 4️⃣ Frontend

```bash
cd app/client
cp .env.example .env    # same SHOPIFY_API_KEY, BACKEND_PORT=8080
npm install
npm run dev             # runs on :5173
```

### 5️⃣ Shopify Partner Dashboard

- **App URL** → your tunnel URL
- **Redirect URL** → `{APP_URL}/auth/callback`
- **App proxy** → prefix `apps`, subpath `drop-waitlist`, URL `{APP_URL}/proxy`
- **Webhooks** → `app/uninstalled`, `inventory_levels/update`, `products/update` → `{APP_URL}/webhooks`

### 6️⃣ First Run

1. Install the app on your dev store
2. **Drops → New Drop → Sync Catalog from Shopify**
3. Create a drop and set it to **Active**
4. Sign up for a waitlist on a sold-out product from the storefront
5. Watch the Dashboard re-rank the Restock Priority list 🎯

---

## 🧮 How the Restock Priority Score works

```
score = 50% waitlist demand  +  35% sell-through rate  +  15% recency of sellout
```

Simple, explainable weights — merchants can trust the number instead of guessing what to reorder.

---

## 📌 Good Files to Review

- `theme/sections/fit-builder.liquid` + `theme/assets/fit-builder.js` — standout theme feature
- `app/server/src/services/scoring.js` — the scoring engine
- `app/server/src/routes/proxy.js` — storefront → app waitlist (HMAC verified)
- `app/server/src/middleware/verifyRequest.js` — embedded auth (token exchange)
- `app/server/src/db/schema.js` — 9-table relational schema
