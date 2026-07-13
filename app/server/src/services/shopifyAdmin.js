/**
 * Thin helpers around the Admin GraphQL API for the handful of calls the
 * app needs: pulling a product/variant picker list, and reconciling
 * inventory counts during a manual sync.
 */
import { shopify } from '../shopify.js';
import { Session } from '@shopify/shopify-api';

function sessionFor(shopRecord) {
  return new Session({
    id: `offline_${shopRecord.shopDomain}`,
    shop: shopRecord.shopDomain,
    state: 'sync',
    isOnline: false,
    accessToken: shopRecord.accessToken
  });
}

const PRODUCTS_QUERY = `#graphql
  query AppProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        status
        featuredImage { url }
        variants(first: 25) {
          nodes {
            id
            title
            sku
            price
            inventoryQuantity
          }
        }
      }
    }
  }
`;

export async function fetchShopifyProducts(shopRecord, { first = 50 } = {}) {
  const client = new shopify.clients.Graphql({ session: sessionFor(shopRecord) });
  const response = await client.request(PRODUCTS_QUERY, { variables: { first } });
  return response.data.products.nodes;
}
