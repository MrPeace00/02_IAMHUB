// Global fulfillment source.
//
// What the vendor label does and does not establish:
//  - The store's own /products.json carries a `vendor` field, enriched onto
//    catalog results by catalog-priority.server.js. A `Printify` vendor
//    identifies which Lazy Customs products are produced and shipped through
//    the Printify print network. That is enough to say a product is made by
//    Printify, and it is what separates this source from the whole-catalog
//    Shopify starter.
//  - It is NOT Printify Choice routing, per-product Choice eligibility, or
//    destination coverage. Those live behind api.printify.com and need a
//    confirmed eligibility/coverage contract plus PRINTIFY_API_TOKEN. Until
//    that source is wired, no branch here may claim verified eligibility or
//    promise delivery to any particular country, and none may ask the buyer
//    for a delivery country: an absent source cannot act on the answer.

const PRINTIFY_VENDOR = /^printify$/i;

export function printifyFulfilled(product) {
  return PRINTIFY_VENDOR.test(String(product?.vendor ?? '').trim());
}

const NO_CATALOG = Object.freeze({
  state: 'unavailable',
  reason: 'catalog_source_not_configured',
  products: [],
  message: 'Global fulfillment results cannot currently be retrieved. Please try again later.',
});

const NONE_FULFILLED = Object.freeze({
  state: 'unavailable',
  reason: 'no_printify_fulfilled_products',
  products: [],
  message: 'No products in the Lazy Customs catalog are currently marked as produced through the Printify print network. You can select Shopify to browse the full store catalog.',
});

// Vendor enrichment is a separate network read in catalog-priority.server.js
// and fails to an empty index. An empty index is "we could not read it", never
// "there are none" -- the two must not share a message.
const VENDOR_METADATA_MISSING = Object.freeze({
  state: 'unavailable',
  reason: 'vendor_metadata_unavailable',
  products: [],
  message: 'Product fulfillment details cannot currently be read, so global fulfillment cannot be confirmed for any product. You can select Shopify to browse the full store catalog.',
});

// Says what the vendor label supports and nothing beyond it. No delivery
// promise, no Choice claim, no destination question.
const FULFILLED_MESSAGE = 'These Lazy Customs products are produced and shipped through the Printify print network. Open a product page to choose options and save any personalization. Printify confirms delivery coverage, times and cost for your address during checkout. A Printify vendor label does not by itself guarantee Printify Choice routing or delivery to every country.';

export async function searchGlobalFulfillment({ searchCatalog } = {}) {
  if (typeof searchCatalog !== 'function') return { ...NO_CATALOG };
  const catalog = await searchCatalog();
  const products = catalog.filter(printifyFulfilled);
  if (!products.length) {
    const anyVendorKnown = catalog.some(product => String(product?.vendor ?? '').trim());
    return catalog.length && !anyVendorKnown ? { ...VENDOR_METADATA_MISSING } : { ...NONE_FULFILLED };
  }
  return { state: 'catalog', fulfillment: 'printify_network', products, message: FULFILLED_MESSAGE };
}
