// BigInt values (e.g. from MySQL BIGINT columns returned by the driver)
// crash JSON.stringify/res.json by default — this makes them serialize as
// plain strings instead, so a stray BigInt in any response body can never
// take down the whole process again (this was the root cause behind the
// intermittent ECONNREFUSED/ECONNRESET errors: an uncaught TypeError inside
// an async route handler crashed the entire Node process, not just that
// request, since Express 4 doesn't catch async throws automatically).
BigInt.prototype.toJSON = function () {
  return this.toString();
};

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shopify } from './shopify.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import proxyRoutes from './routes/proxy.js';
import dashboardRoutes from './routes/api/dashboard.js';
import dropsRoutes from './routes/api/drops.js';
import productsRoutes from './routes/api/products.js';
import waitlistRoutes from './routes/api/waitlist.js';
import activityRoutes from './routes/api/activity.js';
import { verifyRequest } from './middleware/verifyRequest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

const app = express();

// Webhooks need the raw body for HMAC verification, so this is registered
// before the global json() body parser touches the request.
app.use('/webhooks', express.raw({ type: '*/*' }), webhookRoutes);

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// App Proxy calls arrive as regular POSTs from Shopify's edge (not the
// iframe), so they're mounted before the embedded-app CSP header logic.
app.use('/', proxyRoutes);

// OAuth (install flow for non-embedded entry / first install).
app.use('/', authRoutes);

// Every /api/* route requires a verified embedded session token.
const api = express.Router();
api.use(verifyRequest);
api.use(dashboardRoutes);
api.use(dropsRoutes);
api.use(productsRoutes);
api.use(waitlistRoutes);
api.use(activityRoutes);
app.use('/api', api);

// Sets the embedded-app CSP (frame-ancestors) header for whatever shop is
// currently loading the app, so the Admin iframe is allowed to render it.
app.use((req, res, next) => {
  const shop = req.query.shop;
  if (shop) {
    res.setHeader(
      'Content-Security-Policy',
      `frame-ancestors https://${shop} https://admin.shopify.com;`
    );
  }
  next();
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(
      'Drop & Restock Manager API is running. In development, run the Vite frontend separately (npm run dev in /app/client) and open it via your Shopify app preview URL.'
    );
  });
}

app.listen(PORT, () => {
  console.log(`Drop & Restock Manager server listening on port ${PORT}`);
});
