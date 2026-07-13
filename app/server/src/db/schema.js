/**
 * Drizzle ORM schema (MySQL) for the Drop & Restock Manager embedded app.
 *
 * Table map
 * ---------
 * shops            One row per installed store. Holds the offline access token.
 * sessions         Backing store for @shopify/shopify-api's SessionStorage
 *                  interface (custom adapter in db/sessionStorage.js).
 * products         Lightweight cache of Shopify products, synced on demand,
 *                  so drops can be composed without re-hitting the Admin API
 *                  on every page load.
 * product_variants Per-variant price/inventory snapshot; refreshed by the
 *                  inventory_levels/update webhook and periodic sync.
 * drops            A merchant-defined limited drop: a named window of time
 *                  in which a set of products is "live".
 * drop_products    Join table between drops and products, plus the
 *                  baseline inventory captured at drop start (needed to
 *                  compute sell-through rate).
 * waitlist_entries Shopper emails collected from the storefront "Notify Me"
 *                  form (via App Proxy) when a variant is sold out.
 * activity_logs    Append-only audit trail: drop created/updated, waitlist
 *                  signup, low-stock alert fired, restock recommendation
 *                  generated, etc. Powers the History/Activity screen.
 * restock_scores   Time-stamped snapshots of the computed Restock Priority
 *                  Score per product, so the dashboard can show trend
 *                  ("demand climbing") rather than just a single number.
 */

import {
  mysqlTable,
  int,
  bigint,
  varchar,
  text,
  boolean,
  decimal,
  timestamp,
  json,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const shops = mysqlTable('shops', {
  id: int('id').autoincrement().primaryKey(),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
  accessToken: varchar('access_token', { length: 512 }),
  scope: varchar('scope', { length: 512 }),
  planName: varchar('plan_name', { length: 100 }),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
  uninstalledAt: timestamp('uninstalled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
}, (table) => ({
  shopDomainIdx: uniqueIndex('shops_shop_domain_idx').on(table.shopDomain)
}));

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  shopId: int('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
  shop: varchar('shop', { length: 255 }).notNull(),
  isOnline: boolean('is_online').default(false).notNull(),
  state: varchar('state', { length: 255 }),
  scope: varchar('scope', { length: 512 }),
  expires: timestamp('expires'),
  // Full serialized shopify-api Session object (includes accessToken,
  // onlineAccessInfo, etc). Keeping one JSON blob keeps this adapter
  // resilient to shopify-api version changes.
  payload: json('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  shopIdx: index('sessions_shop_idx').on(table.shop)
}));

export const products = mysqlTable('products', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  shopifyProductId: bigint('shopify_product_id', { mode: 'string' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  handle: varchar('handle', { length: 255 }),
  imageUrl: varchar('image_url', { length: 1024 }),
  status: varchar('status', { length: 50 }).default('active'),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  shopProductIdx: uniqueIndex('products_shop_product_idx').on(table.shopId, table.shopifyProductId)
}));

export const productVariants = mysqlTable('product_variants', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  shopifyVariantId: bigint('shopify_variant_id', { mode: 'string' }).notNull(),
  title: varchar('title', { length: 255 }),
  sku: varchar('sku', { length: 255 }),
  price: decimal('price', { precision: 10, scale: 2 }).default('0.00'),
  inventoryQuantity: int('inventory_quantity').default(0),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
}, (table) => ({
  variantIdx: uniqueIndex('variants_shopify_variant_idx').on(table.shopifyVariantId)
}));

export const drops = mysqlTable('drops', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: mysqlEnum('status', ['draft', 'scheduled', 'active', 'ended']).default('draft').notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at'),
  waitlistEnabled: boolean('waitlist_enabled').default(true).notNull(),
  lowStockThreshold: int('low_stock_threshold').default(5).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
}, (table) => ({
  shopStatusIdx: index('drops_shop_status_idx').on(table.shopId, table.status)
}));

export const dropProducts = mysqlTable('drop_products', {
  id: int('id').autoincrement().primaryKey(),
  dropId: int('drop_id').notNull().references(() => drops.id, { onDelete: 'cascade' }),
  productId: int('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  // Inventory captured the moment the product was added to a live drop —
  // the denominator for sell-through-rate scoring.
  baselineInventory: int('baseline_inventory').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  dropProductIdx: uniqueIndex('drop_products_drop_product_idx').on(table.dropId, table.productId)
}));

export const waitlistEntries = mysqlTable('waitlist_entries', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  productId: int('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: int('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  dropId: int('drop_id').references(() => drops.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 320 }).notNull(),
  source: varchar('source', { length: 50 }).default('storefront').notNull(),
  notifiedAt: timestamp('notified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  productIdx: index('waitlist_product_idx').on(table.productId),
  shopEmailProductIdx: uniqueIndex('waitlist_shop_email_product_idx').on(table.shopId, table.email, table.productId)
}));

export const activityLogs = mysqlTable('activity_logs', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  actor: varchar('actor', { length: 100 }).default('system').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: varchar('entity_id', { length: 100 }),
  message: varchar('message', { length: 512 }),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  shopCreatedIdx: index('activity_shop_created_idx').on(table.shopId, table.createdAt)
}));

export const restockScores = mysqlTable('restock_scores', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  productId: int('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  dropId: int('drop_id').references(() => drops.id, { onDelete: 'set null' }),
  score: decimal('score', { precision: 6, scale: 2 }).notNull(),
  waitlistCount: int('waitlist_count').default(0).notNull(),
  sellThroughRate: decimal('sell_through_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  daysSinceSoldOut: int('days_since_sold_out'),
  computedAt: timestamp('computed_at').defaultNow().notNull()
}, (table) => ({
  productComputedIdx: index('restock_scores_product_computed_idx').on(table.productId, table.computedAt)
}));

/* ---------- Relations (for query-builder ergonomics) ---------- */

export const shopsRelations = relations(shops, ({ many }) => ({
  products: many(products),
  drops: many(drops),
  waitlistEntries: many(waitlistEntries),
  activityLogs: many(activityLogs)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  shop: one(shops, { fields: [products.shopId], references: [shops.id] }),
  variants: many(productVariants),
  dropProducts: many(dropProducts),
  waitlistEntries: many(waitlistEntries)
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] })
}));

export const dropsRelations = relations(drops, ({ one, many }) => ({
  shop: one(shops, { fields: [drops.shopId], references: [shops.id] }),
  dropProducts: many(dropProducts),
  waitlistEntries: many(waitlistEntries)
}));

export const dropProductsRelations = relations(dropProducts, ({ one }) => ({
  drop: one(drops, { fields: [dropProducts.dropId], references: [drops.id] }),
  product: one(products, { fields: [dropProducts.productId], references: [products.id] })
}));

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  shop: one(shops, { fields: [waitlistEntries.shopId], references: [shops.id] }),
  product: one(products, { fields: [waitlistEntries.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [waitlistEntries.variantId], references: [productVariants.id] }),
  drop: one(drops, { fields: [waitlistEntries.dropId], references: [drops.id] })
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  shop: one(shops, { fields: [activityLogs.shopId], references: [shops.id] })
}));

export const restockScoresRelations = relations(restockScores, ({ one }) => ({
  shop: one(shops, { fields: [restockScores.shopId], references: [shops.id] }),
  product: one(products, { fields: [restockScores.productId], references: [products.id] }),
  drop: one(drops, { fields: [restockScores.dropId], references: [drops.id] })
}));
