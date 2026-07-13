import { Router } from 'express';
import { shopify } from '../shopify.js';
import { db } from '../db/client.js';
import { shops } from '../db/schema.js';
import { isNull } from 'drizzle-orm';
import { logActivity } from '../services/activity.js';
import { registerWebhooks } from '../services/webhooks.js';

const router = Router();

/**
 * Classic OAuth entry points. These are hit when a merchant installs the
 * app from the Shopify App Store / a direct install link (i.e. before the
 * app is embedded and before App Bridge exists to do token exchange).
 * Once installed, session-token + token-exchange (see middleware/verifyRequest.js)
 * handles auth for every embedded API call without another redirect.
 */
router.get('/auth', async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop parameter');

  await shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(shop, true),
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res
  });
});

router.get('/auth/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
    const { session } = callback;

    await registerWebhooks(session);
    await logActivity({
      shopDomain: session.shop,
      actor: 'system',
      action: 'app_installed',
      message: 'App installed and offline token stored.'
    });

    const host = req.query.host;
    return res.redirect(`/?shop=${session.shop}&host=${host}`);
  } catch (err) {
    console.error('[auth/callback] failed', err);
    res.status(500).send('Authentication failed. Check server logs.');
  }
});

router.get('/auth/uninstalled-check', async (req, res) => {
  // Convenience endpoint for local debugging of installed shops.
  const rows = await db.select().from(shops).where(isNull(shops.uninstalledAt));
  res.json(rows);
});

export default router;
