import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { activityLogs } from '../../db/schema.js';

const router = Router();

// GET /api/activity — paginated audit trail for the History screen.
router.get('/activity', async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;

  const rows = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.shopId, req.shopRecord.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

export default router;
