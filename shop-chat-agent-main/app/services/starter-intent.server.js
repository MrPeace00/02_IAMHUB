import { searchGlobalFulfillment } from './global-fulfillment.server.js';

// Keep the two static theme assets in sync; regression tests compare this enum.
export const STARTER_INTENTS = Object.freeze(['global_fulfillment', 'shopify_catalog']);

export function validStarterIntent(intent) {
  return intent === undefined || STARTER_INTENTS.includes(intent);
}

const CUSTOMER_ORIGINS = new Set([
  'https://lazycustoms.com', 'https://www.lazycustoms.com',
  'https://vbw9zu-f7.myshopify.com', 'https://lazy-customs-2.myshopify.com',
]);

export function customerProductUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, 'https://lazycustoms.com');
    if (!CUSTOMER_ORIGINS.has(url.origin) || url.username || url.password ||
        !/^\/products\/[a-z0-9][a-z0-9-]*\/?$/i.test(url.pathname)) return '';
    // Product identity comes from the returned product URL, never a title guess.
    // Strip query/fragment so redirect or merchant parameters cannot survive.
    return `https://lazycustoms.com${url.pathname}`;
  } catch {
    return '';
  }
}

export async function dispatchStarter({ intent, searchShopify, searchGlobal = searchGlobalFulfillment }) {
  if (!validStarterIntent(intent)) throw new TypeError('Unsupported starter intent');
  if (intent === undefined) return null; // Existing general chat; no implicit inheritance.

  // One catalog backs both starters, because the store has one catalog. The
  // starters differ in which products they keep and what each may claim about
  // fulfillment, not in pretending a second product source exists.
  const approvedProducts = async () => (await searchShopify())
    .map(product => ({ ...product, url: customerProductUrl(product.url) }))
    .filter(product => product.url);

  if (intent === 'global_fulfillment') {
    try {
      return { intent, ...await searchGlobal({ searchCatalog: approvedProducts }) };
    } catch {
      // Never emit raw provider errors or fall back to the unfiltered catalog.
      return { intent, state: 'unavailable', reason: 'provider_unavailable',
        message: 'Global fulfillment results cannot currently be retrieved. Please try again later.', products: [] };
    }
  }

  try {
    const products = await approvedProducts();
    return { intent, state: 'catalog', products,
      message: products.length
        ? 'Here are products from the Lazy Customs Shopify catalog. Open a product page to choose options and check its personalization instructions. Store catalog results do not verify Printify Choice eligibility or global delivery.'
        : 'No products with approved customer pages were found in the Lazy Customs Shopify catalog.' };
  } catch {
    return { intent, state: 'unavailable', reason: 'catalog_unavailable', products: [],
      message: 'The Lazy Customs Shopify catalog is temporarily unavailable. Please try again later.' };
  }
}
