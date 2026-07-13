/**
 * Restock Priority Score
 * =======================
 * The logic-based feature required by the brief. Answers the merchant's
 * actual question during a drop: "of everything that's low or sold out
 * right now, what should I reorder first?"
 *
 * score = clamp(0, 100,
 *     W_WAITLIST   * normalizedWaitlistDemand
 *   + W_SELLTHROUGH* sellThroughRate
 *   + W_RECENCY    * recencyBoost
 * )
 *
 * - normalizedWaitlistDemand: waitlist signups for the product, scaled
 *   against the single hottest product in the same drop (so a 50-person
 *   waitlist on a 12-item drop isn't judged against a store's all-time max).
 * - sellThroughRate: units sold / baseline inventory captured when the
 *   product went live in the drop. A product that sold through 100% of a
 *   small batch is stronger restock signal than one that sold 30% of a
 *   huge batch, independent of raw units.
 * - recencyBoost: decays demand signal for products that sold out weeks
 *   ago and nobody has waitlisted since — old sellouts are less urgent than
 *   a variant that sold out yesterday and is still collecting emails today.
 *
 * Weights are intentionally simple/explainable (sum to 1) rather than a
 * black box, since merchants making inventory decisions want to trust the
 * number.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products, productVariants, waitlistEntries, dropProducts, restockScores, drops } from '../db/schema.js';

const WEIGHTS = {
  waitlist: 0.5,
  sellThrough: 0.35,
  recency: 0.15
};

function recencyBoost(daysSinceSoldOut) {
  if (daysSinceSoldOut === null || daysSinceSoldOut === undefined) return 0.5; // never sold out / unknown -> neutral
  if (daysSinceSoldOut <= 1) return 1;
  if (daysSinceSoldOut >= 30) return 0;
  // Linear decay from 1 -> 0 across 30 days.
  return Math.max(0, 1 - daysSinceSoldOut / 30);
}

/**
 * Computes and persists a fresh score snapshot for a single product. Returns
 * the score row. Call this after: a waitlist signup, an inventory webhook,
 * or a drop status change.
 */
export async function recomputeScoreForProduct({ shopId, productId, dropId = null }) {
  const [waitlistCountRow] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.productId, productId));
  const waitlistCount = waitlistCountRow?.count ?? 0;

  // Highest waitlist count among products in the same drop, for normalization.
  let maxWaitlistInDrop = waitlistCount || 1;
  if (dropId) {
    const dropProductRows = await db
      .select({ productId: dropProducts.productId })
      .from(dropProducts)
      .where(eq(dropProducts.dropId, dropId));

    for (const row of dropProductRows) {
      const [countRow] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(waitlistEntries)
        .where(eq(waitlistEntries.productId, row.productId));
      maxWaitlistInDrop = Math.max(maxWaitlistInDrop, countRow?.count ?? 0);
    }
  }
  const normalizedWaitlistDemand = maxWaitlistInDrop > 0 ? waitlistCount / maxWaitlistInDrop : 0;

  // Sell-through: sum current inventory across variants vs baseline captured at drop start.
  const variantRows = await db
    .select({ inventoryQuantity: productVariants.inventoryQuantity })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const currentInventory = variantRows.reduce((sum, v) => sum + (v.inventoryQuantity ?? 0), 0);

  let baselineInventory = 0;
  if (dropId) {
    const [dp] = await db
      .select()
      .from(dropProducts)
      .where(and(eq(dropProducts.dropId, dropId), eq(dropProducts.productId, productId)))
      .limit(1);
    baselineInventory = dp?.baselineInventory ?? 0;
  }

  const unitsSold = Math.max(0, baselineInventory - currentInventory);
  const sellThroughRate = baselineInventory > 0 ? Math.min(1, unitsSold / baselineInventory) : 0;

  // Recency: days since inventory hit zero. We approximate using the most
  // recent waitlist signup as a proxy for "still sold out and in demand" —
  // a full implementation would track a soldOutAt timestamp on the variant.
  const [latestWaitlistEntry] = await db
    .select({ createdAt: waitlistEntries.createdAt })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.productId, productId))
    .orderBy(sql`${waitlistEntries.createdAt} desc`)
    .limit(1);

  let daysSinceSoldOut = null;
  if (currentInventory === 0 && latestWaitlistEntry) {
    daysSinceSoldOut = Math.floor((Date.now() - new Date(latestWaitlistEntry.createdAt).getTime()) / 86400000);
  }

  const score =
    WEIGHTS.waitlist * normalizedWaitlistDemand * 100 +
    WEIGHTS.sellThrough * sellThroughRate * 100 +
    WEIGHTS.recency * recencyBoost(daysSinceSoldOut) * 100;

  const clampedScore = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

  await db.insert(restockScores).values({
    shopId,
    productId,
    dropId,
    score: clampedScore.toFixed(2),
    waitlistCount,
    sellThroughRate: (sellThroughRate * 100).toFixed(2),
    daysSinceSoldOut
  });

  return {
    productId,
    score: clampedScore,
    waitlistCount,
    sellThroughRate: Math.round(sellThroughRate * 100),
    daysSinceSoldOut
  };
}

/**
 * Ranked "what to restock next" list for a shop, optionally scoped to a
 * single drop. Recomputes on demand (cheap: a handful of aggregate queries
 * per product) rather than relying purely on cached snapshots, so the
 * dashboard is always current.
 */
export async function getRestockPriorityList({ shopId, dropId = null, limit = 20 }) {
  let productRows;
  if (dropId) {
    productRows = await db
      .select({ id: products.id, title: products.title, imageUrl: products.imageUrl })
      .from(dropProducts)
      .innerJoin(products, eq(dropProducts.productId, products.id))
      .where(eq(dropProducts.dropId, dropId));
  } else {
    productRows = await db
      .select({ id: products.id, title: products.title, imageUrl: products.imageUrl })
      .from(products)
      .where(eq(products.shopId, shopId));
  }

  const scored = [];
  for (const product of productRows) {
    const result = await recomputeScoreForProduct({ shopId, productId: product.id, dropId });
    scored.push({ ...product, ...result });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Low-stock alert check for products in an active drop. Returns items under
 * the drop's configured threshold — used by the dashboard's alert banner
 * and can be wired to a scheduled job for email/Slack notifications.
 */
export async function getLowStockAlerts({ shopId, dropId }) {
  const [drop] = await db.select().from(drops).where(eq(drops.id, dropId)).limit(1);
  if (!drop) return [];

  const dropProductRows = await db
    .select({ productId: dropProducts.productId, productTitle: products.title })
    .from(dropProducts)
    .innerJoin(products, eq(dropProducts.productId, products.id))
    .where(eq(dropProducts.dropId, dropId));

  const alerts = [];
  for (const row of dropProductRows) {
    const variantRows = await db
      .select({ inventoryQuantity: productVariants.inventoryQuantity, title: productVariants.title })
      .from(productVariants)
      .where(eq(productVariants.productId, row.productId));

    const lowVariants = variantRows.filter((v) => (v.inventoryQuantity ?? 0) <= drop.lowStockThreshold);
    if (lowVariants.length > 0) {
      alerts.push({ productId: row.productId, productTitle: row.productTitle, lowVariants });
    }
  }

  return alerts;
}
