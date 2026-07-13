import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import { restResources } from '@shopify/shopify-api/rest/admin/2024-10';
import { DrizzleSessionStorage } from './db/sessionStorage.js';

const requiredEnv = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_APP_URL', 'DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[shopify] Missing env var ${key} — see .env.example.`);
  }
}

const appUrl = new URL(process.env.SHOPIFY_APP_URL || 'http://localhost:8080');

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || 'read_products,write_products,read_inventory,write_inventory,read_orders').split(','),
  hostName: appUrl.host,
  hostScheme: appUrl.protocol.replace(':', ''),
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: true,
  restResources,
  sessionStorage: new DrizzleSessionStorage()
});

export const APP_SCOPES = process.env.SCOPES || 'read_products,write_products,read_inventory,write_inventory,read_orders';
