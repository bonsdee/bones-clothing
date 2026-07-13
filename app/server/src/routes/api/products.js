import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { products, productVariants } from '../../db/schema.js';
import { fetchShopifyProducts } from '../../services/shopifyAdmin.js';
import { logActivity } from '../../services/activity.js';

const router = Router();

// GET /api/products — cached product list, used by the drop-builder picker.
router.get('/products', async (req, res) => {
  const rows = await db.select().from(products).where(eq(products.shopId, req.shopRecord.id));
  res.json(rows);
});

// POST /api/products/sync — pulls latest products/variants from Shopify and
// upserts the local cache. Kept as an explicit, merchant-triggered action
// (rather than a hidden background poll) so the create/update workflow has
// a clear "refresh my catalog" step, which is also logged for traceability.
router.post('/products/sync', async (req, res) => {
  try {
    const shopifyProducts = await fetchShopifyProducts(req.shopRecord);
    let created = 0;
    let updated = 0;

    for (const sp of shopifyProducts) {
      const shopifyProductId = sp.id.split('/').pop();
      const [existing] = await db
        .select()
        .from(products)
        .where(eq(products.shopifyProductId, shopifyProductId))
        .limit(1);

      let productRowId;
      if (existing) {
        await db
          .update(products)
          .set({ title: sp.title, handle: sp.handle, imageUrl: sp.featuredImage?.url ?? null, status: sp.status, syncedAt: new Date() })
          .where(eq(products.id, existing.id));
        productRowId = existing.id;
        updated += 1;
      } else {
        const [inserted] = await db
          .insert(products)
          .values({
            shopId: req.shopRecord.id,
            shopifyProductId,
            title: sp.title,
            handle: sp.handle,
            imageUrl: sp.featuredImage?.url ?? null,
            status: sp.status
          })
          .$returningId();
        productRowId = inserted.id;
        created += 1;
      }

      for (const variant of sp.variants.nodes) {
        const shopifyVariantId = variant.id.split('/').pop();
        const [existingVariant] = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.shopifyVariantId, shopifyVariantId))
          .limit(1);

        if (existingVariant) {
          await db
            .update(productVariants)
            .set({ title: variant.title, sku: variant.sku, price: variant.price, inventoryQuantity: variant.inventoryQuantity ?? 0 })
            .where(eq(productVariants.id, existingVariant.id));
        } else {
          await db.insert(productVariants).values({
            productId: productRowId,
            shopifyVariantId,
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            inventoryQuantity: variant.inventoryQuantity ?? 0
          });
        }
      }
    }

    await logActivity({
      shopId: req.shopRecord.id,
      actor: 'user',
      action: 'products_synced',
      message: `Synced catalog: ${created} new, ${updated} updated.`
    });

    res.json({ created, updated, total: shopifyProducts.length });
  } catch (err) {
    console.error('[products/sync] failed', err);
    res.status(502).json({ error: 'Could not reach Shopify Admin API', detail: err.message });
  }
});

export default router;
