import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { waitlistEntries, products } from '../../db/schema.js';

const router = Router();

// GET /api/waitlist?productId=&dropId= — list entries, most recent first.
// This backs the Waitlist screen merchants use to see who's asking for what.
router.get('/waitlist', async (req, res) => {
  const conditions = [eq(waitlistEntries.shopId, req.shopRecord.id)];
  if (req.query.productId) conditions.push(eq(waitlistEntries.productId, Number(req.query.productId)));
  if (req.query.dropId) conditions.push(eq(waitlistEntries.dropId, Number(req.query.dropId)));

  const rows = await db
    .select({
      id: waitlistEntries.id,
      email: waitlistEntries.email,
      createdAt: waitlistEntries.createdAt,
      notifiedAt: waitlistEntries.notifiedAt,
      productId: waitlistEntries.productId,
      productTitle: products.title
    })
    .from(waitlistEntries)
    .innerJoin(products, eq(waitlistEntries.productId, products.id))
    .where(and(...conditions))
    .orderBy(desc(waitlistEntries.createdAt))
    .limit(200);

  res.json(rows);
});

// POST /api/waitlist/:id/notify — mark an entry as notified (merchant sent
// a manual restock email/DM). Kept simple; a future iteration could trigger
// an actual email via Shopify Email or a transactional provider.
router.post('/waitlist/:id/notify', async (req, res) => {
  const id = Number(req.params.id);
  await db.update(waitlistEntries).set({ notifiedAt: new Date() }).where(eq(waitlistEntries.id, id));
  res.json({ ok: true });
});

export default router;
