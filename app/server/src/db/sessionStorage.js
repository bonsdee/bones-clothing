/**
 * Custom SessionStorage adapter for @shopify/shopify-api, backed by the
 * `sessions` table via Drizzle. Implements the four methods the library
 * requires: storeSession, loadSession, deleteSession, deleteSessions,
 * plus findSessionsByShop which the app uses to look up a shop's offline
 * token outside of a request context (e.g. background jobs).
 */
import { Session } from '@shopify/shopify-api';
import { eq, inArray } from 'drizzle-orm';
import { db } from './client.js';
import { sessions, shops } from './schema.js';

async function ensureShopRow(shopDomain) {
  const [existing] = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);
  if (existing) return existing;

  await db.insert(shops).values({ shopDomain });
  const [created] = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);
  return created;
}

export class DrizzleSessionStorage {
  async storeSession(session) {
    const shopRow = await ensureShopRow(session.shop);

    // Keep shops.accessToken in sync for offline sessions — most of the app's
    // background/API logic reads the token straight off `shops`, while the
    // `sessions` table remains the source of truth shopify-api expects.
    if (!session.isOnline && session.accessToken) {
      await db
        .update(shops)
        .set({ accessToken: session.accessToken, scope: session.scope })
        .where(eq(shops.id, shopRow.id));
    }

    const payload = session.toPropertyArray
      ? Object.fromEntries(session.toPropertyArray())
      : { ...session };

    await db
      .insert(sessions)
      .values({
        id: session.id,
        shopId: shopRow.id,
        shop: session.shop,
        isOnline: session.isOnline,
        state: session.state,
        scope: session.scope,
        expires: session.expires ? new Date(session.expires) : null,
        payload
      })
      .onDuplicateKeyUpdate({
        set: {
          shop: session.shop,
          isOnline: session.isOnline,
          state: session.state,
          scope: session.scope,
          expires: session.expires ? new Date(session.expires) : null,
          payload
        }
      });

    return true;
  }

  async loadSession(id) {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!row) return undefined;
    return new Session(row.payload);
  }

  async deleteSession(id) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return true;
  }

  async deleteSessions(ids) {
    if (!ids?.length) return true;
    await db.delete(sessions).where(inArray(sessions.id, ids));
    return true;
  }

  async findSessionsByShop(shop) {
    const rows = await db.select().from(sessions).where(eq(sessions.shop, shop));
    return rows.map((row) => new Session(row.payload));
  }
}
