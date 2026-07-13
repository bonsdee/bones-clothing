/**
 * Auth middleware for embedded API calls.
 *
 * The Vite/React frontend runs inside the Shopify Admin iframe via App
 * Bridge, which attaches a short-lived session token (JWT) to every request
 * as `Authorization: Bearer <token>`. We verify that token, then use
 * Shopify's Token Exchange flow to get (or reuse a cached) offline access
 * token for the shop — no OAuth redirect is needed inside the iframe, which
 * is what makes the embedded experience feel like a single page app instead
 * of bouncing the merchant around.
 */
import { shopify } from '../shopify.js';
import { db } from '../db/client.js';
import { shops } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function verifyRequest(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({ error: 'Missing session token' });
    }

    const payload = await shopify.session.decodeSessionToken(token);
    const shopDomain = payload.dest.replace('https://', '');

    let [shopRow] = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);

    if (!shopRow || !shopRow.accessToken) {
      // First embedded call for this shop in this process, or the offline
      // token was never captured (e.g. dev shortcut). Exchange the session
      // token for a real offline access token.
      const { session } = await shopify.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: token,
        requestedTokenType: 'urn:shopify:params:oauth:token-type:offline-access-token'
      });

      await db
        .insert(shops)
        .values({ shopDomain, accessToken: session.accessToken, scope: session.scope })
        .onDuplicateKeyUpdate({ set: { accessToken: session.accessToken, scope: session.scope } });

      [shopRow] = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);
    }

    req.shopDomain = shopDomain;
    req.shopRecord = shopRow;
    next();
  } catch (err) {
    console.error('[verifyRequest] auth failed', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
}
