import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { drops, waitlistEntries, activityLogs, products } from '../../db/schema.js';
import { getRestockPriorityList } from '../../services/scoring.js';

const router = Router();

// GET /api/dashboard — the single call the Dashboard screen needs: active
// drop counts, total waitlist demand, top restock priorities across all
// live drops, and the latest activity for a quick pulse-check.
router.get('/dashboard', async (req, res) => {
  const shopId = req.shopRecord.id;

  const [activeDropsRow] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(drops)
    .where(and(eq(drops.shopId, shopId), eq(drops.status, 'active')));

  const [waitlistRow] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.shopId, shopId));

  const [productCountRow] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(products)
    .where(eq(products.shopId, shopId));

  const topPriority = await getRestockPriorityList({ shopId, limit: 8 });

  const recentActivity = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.shopId, shopId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(10);

  const activeDropRows = await db
    .select()
    .from(drops)
    .where(and(eq(drops.shopId, shopId), eq(drops.status, 'active')));

  res.json({
    stats: {
      activeDrops: activeDropsRow?.count ?? 0,
      totalWaitlistSignups: waitlistRow?.count ?? 0,
      catalogSize: productCountRow?.count ?? 0
    },
    activeDrops: activeDropRows,
    topRestockPriority: topPriority,
    recentActivity
  });
});

export default router;
