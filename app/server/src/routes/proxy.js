/**
 * Shopify App Proxy endpoint. Configured in the Partner Dashboard as:
 *   Subpath prefix: apps
 *   Subpath: drop-waitlist
 * so a storefront request to /apps/drop-waitlist/subscribe is proxied by
 * Shopify to POST {SHOPIFY_APP_URL}/proxy/subscribe with a `signature`
 * query param this route verifies before trusting the request.
 *
 * This is what lets the theme's restock-notify.liquid section write real
 * waitlist_entries rows without shipping any app credentials to the browser.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { shops, products, productVariants, waitlistEntries } from '../db/schema.js';
import { logActivity } from '../services/activity.js';
import { recomputeScoreForProduct } from '../services/scoring.js';

const router = Router();

function verifyProxySignature(query) {
  const { signature, ...rest } = query;
  if (!signature) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('');

  const digest = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

router.post('/proxy/subscribe', async (req, res) => {
  if (!verifyProxySignature(req.query)) {
    return res.status(401).json({ error: 'Invalid proxy signature' });
  }

  const shopDomain = req.query.shop || req.body.shop;
  const { product_id: shopifyProductId, variant_id: shopifyVariantId, email } = req.body;

  if (!shopDomain || !shopifyProductId || !email) {
    return res.status(400).json({ error: 'shop, product_id and email are required' });
  }

  const [shopRow] = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);
  if (!shopRow) return res.status(404).json({ error: 'Unknown shop' });

  const [productRow] = await db
    .select()
    .from(products)
    .where(eq(products.shopifyProductId, String(shopifyProductId)))
    .limit(1);
  if (!productRow) return res.status(404).json({ error: 'Product not synced yet — run a catalog sync in the app.' });

  let variantRowId = null;
  if (shopifyVariantId) {
    const [variantRow] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.shopifyVariantId, String(shopifyVariantId)))
      .limit(1);
    variantRowId = variantRow?.id ?? null;
  }

  await db
    .insert(waitlistEntries)
    .values({ shopId: shopRow.id, productId: productRow.id, variantId: variantRowId, email, source: 'storefront' })
    .onDuplicateKeyUpdate({ set: { createdAt: new Date() } });

  await logActivity({
    shopId: shopRow.id,
    actor: 'storefront',
    action: 'waitlist_signup',
    entityType: 'product',
    entityId: productRow.id,
    message: `${email} joined the waitlist for "${productRow.title}".`
  });

  await recomputeScoreForProduct({ shopId: shopRow.id, productId: productRow.id });

  res.json({ ok: true });
});

export default router;
