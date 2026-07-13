import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Injects %SHOPIFY_API_KEY% into index.html at build/dev time (App Bridge's
// script tag needs it as a plain meta tag before any JS runs) and proxies
// /api + /auth to the Express backend during local dev.
function injectShopifyApiKey(env) {
  return {
    name: 'inject-shopify-api-key',
    transformIndexHtml(html) {
      return html.replace('%SHOPIFY_API_KEY%', env.SHOPIFY_API_KEY || '');
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.BACKEND_PORT || 8080;

  return {
    plugins: [react(), injectShopifyApiKey(env)],
    server: {
      port: 5173,
      // Cloudflare quick tunnels use a fresh random *.trycloudflare.com
      // hostname on every restart. Vite 5 blocks unrecognized Host headers
      // by default (DNS-rebinding protection), so allow the whole
      // trycloudflare.com family rather than hardcoding one hostname that
      // will go stale the next time the tunnel restarts.
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': `http://localhost:${backendPort}`,
        '/auth': `http://localhost:${backendPort}`,
        // Shopify App Proxy requests (storefront "Notify Me" waitlist form)
        // arrive here at /proxy/* and must reach the Express backend, just
        // like /api and /auth. Without this the tunnel (which points at Vite)
        // would swallow /proxy/subscribe as an SPA route and never hit the
        // backend handler.
        '/proxy': `http://localhost:${backendPort}`
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
