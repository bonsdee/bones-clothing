import { Router } from 'express';
import { shopify } from '../shopify.js';
import '../services/webhooks.js'; // registers handlers as a side effect

const router = Router();

// express.raw is applied in index.js for this path specifically, since
// Shopify webhook HMAC verification needs the untouched request body.
router.post('/webhooks', async (req, res) => {
  try {
    await shopify.webhooks.process({
      rawBody: req.body.toString('utf8'),
      rawRequest: req,
      rawResponse: res
    });
  } catch (err) {
    console.error('[webhooks] processing failed', err);
    if (!res.headersSent) res.status(500).send(err.message);
  }
});

export default router;
