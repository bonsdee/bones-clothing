import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { drops, dropProducts, products, productVariants } from '../../db/schema.js';
import { logActivity } from '../../services/activity.js';
import { getRestockPriorityList, getLowStockAlerts } from '../../services/scoring.js';

const router = Router();

// GET /api/drops — list, newest first.
router.get('/drops', async (req, res) => {
  const rows = await db
    .select()
    .from(drops)
    .where(eq(drops.shopId, req.shopRecord.id))
    .orderBy(drops.createdAt);
  res.json(rows.reverse());
});

// GET /api/drops/:id — single drop with its products + live restock ranking
// + low-stock alerts. This is the "detail" view of the create/update workflow.
router.get('/drops/:id', async (req, res) => {
  const dropId = Number(req.params.id);
  const [drop] = await db
    .select()
    .from(drops)
    .where(and(eq(drops.id, dropId), eq(drops.shopId, req.shopRecord.id)))
    .limit(1);

  if (!drop) return res.status(404).json({ error: 'Drop not found' });

  const dropProductRows = await db
    .select({
      dropProductId: dropProducts.id,
      productId: products.id,
      title: products.title,
      imageUrl: products.imageUrl,
      baselineInventory: dropProducts.baselineInventory
    })
    .from(dropProducts)
    .innerJoin(products, eq(dropProducts.productId, products.id))
    .where(eq(dropProducts.dropId, dropId));

  const priorityList = await getRestockPriorityList({ shopId: req.shopRecord.id, dropId, limit: 50 });
  const alerts = await getLowStockAlerts({ shopId: req.shopRecord.id, dropId });

  res.json({ ...drop, products: dropProductRows, restockPriority: priorityList, lowStockAlerts: alerts });
});

// POST /api/drops — create a drop with its product list. Captures baseline
// inventory per product at creation time so sell-through-rate scoring has a
// stable denominator even as stock depletes afterward.
router.post('/drops', async (req, res) => {
  const { name, description, startsAt, endsAt, waitlistEnabled = true, lowStockThreshold = 5, productIds = [] } = req.body;

  if (!name || !startsAt) {
    return res.status(400).json({ error: 'name and startsAt are required' });
  }

  const [inserted] = await db
    .insert(drops)
    .values({
      shopId: req.shopRecord.id,
      name,
      description,
      status: 'scheduled',
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      waitlistEnabled,
      lowStockThreshold
    })
    .$returningId();

  const dropId = inserted.id;

  for (const productId of productIds) {
    const variantRows = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    const baselineInventory = variantRows.reduce((sum, v) => sum + (v.inventoryQuantity ?? 0), 0);

    await db.insert(dropProducts).values({ dropId, productId, baselineInventory });
  }

  await logActivity({
    shopId: req.shopRecord.id,
    actor: 'user',
    action: 'drop_created',
    entityType: 'drop',
    entityId: dropId,
    message: `Drop "${name}" created with ${productIds.length} products.`
  });

  res.status(201).json({ id: dropId });
});

// PATCH /api/drops/:id — update fields and/or product list, status transitions.
router.patch('/drops/:id', async (req, res) => {
  const dropId = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(drops)
    .where(and(eq(drops.id, dropId), eq(drops.shopId, req.shopRecord.id)))
    .limit(1);
  if (!existing) return res.status(404).json({ error: 'Drop not found' });

  const { name, description, status, startsAt, endsAt, waitlistEnabled, lowStockThreshold, productIds } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (startsAt !== undefined) updates.startsAt = new Date(startsAt);
  if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null;
  if (waitlistEnabled !== undefined) updates.waitlistEnabled = waitlistEnabled;
  if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold;

  if (Object.keys(updates).length > 0) {
    await db.update(drops).set(updates).where(eq(drops.id, dropId));
  }

  if (Array.isArray(productIds)) {
    await db.delete(dropProducts).where(eq(dropProducts.dropId, dropId));
    for (const productId of productIds) {
      const variantRows = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
      const baselineInventory = variantRows.reduce((sum, v) => sum + (v.inventoryQuantity ?? 0), 0);
      await db.insert(dropProducts).values({ dropId, productId, baselineInventory });
    }
  }

  await logActivity({
    shopId: req.shopRecord.id,
    actor: 'user',
    action: 'drop_updated',
    entityType: 'drop',
    entityId: dropId,
    message: `Drop "${existing.name}" updated.`,
    metadata: { changed: Object.keys(req.body) }
  });

  res.json({ ok: true });
});

export default router;
