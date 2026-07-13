/**
 * Fetch wrapper that attaches the current App Bridge session token to every
 * request. Session tokens are short-lived (about a minute), so we fetch a
 * fresh one per call rather than caching it.
 */
import { getSessionToken } from '@shopify/app-bridge-utils';
import createApp from '@shopify/app-bridge';

let appBridgeInstance = null;

function getApp() {
  if (appBridgeInstance) return appBridgeInstance;

  const params = new URLSearchParams(window.location.search);
  const host = params.get('host');
  const apiKey = document.querySelector('meta[name="shopify-api-key"]')?.content;

  if (!host || !apiKey) {
    // Running outside the Shopify iframe (e.g. plain `vite dev` with no
    // ?host= param) — callers should fall back to a dev-only auth path.
    return null;
  }

  appBridgeInstance = createApp({ apiKey, host, forceRedirect: true });
  return appBridgeInstance;
}

async function authHeader() {
  const app = getApp();
  if (!app) return {};
  const token = await getSessionToken(app);
  return { Authorization: `Bearer ${token}` };
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...(options.headers || {})
  };

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${path} failed with ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) })
};
