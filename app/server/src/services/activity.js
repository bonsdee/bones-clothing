import { db } from '../db/client.js';
import { activityLogs, shops } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Central place every part of the app writes activity through, so the
 * History/Activity screen never has to guess where an event came from.
 * Accepts either a resolved shopId or a shopDomain (webhooks only know the
 * domain).
 */
export async function logActivity({ shopId, shopDomain, actor = 'system', action, entityType, entityId, message, metadata }) {
  let resolvedShopId = shopId;

  if (!resolvedShopId && shopDomain) {
    const [row] = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);
    resolvedShopId = row?.id;
  }

  if (!resolvedShopId) {
    console.warn('[activity] dropped event, no shop resolved:', action);
    return null;
  }

  await db.insert(activityLogs).values({
    shopId: resolvedShopId,
    actor,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    message,
    metadata: metadata ?? null
  });

  return true;
}
