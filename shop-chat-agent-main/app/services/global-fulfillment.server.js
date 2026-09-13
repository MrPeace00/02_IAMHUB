// Server-only boundary. The existing Printify order client does not establish
// catalog Choice eligibility, destination coverage, or a customer URL mapping.
// Do not wire it here until those provider response fields are confirmed.
export async function searchGlobalFulfillment() {
  return {
    state: 'unavailable',
    reason: 'eligibility_source_not_configured',
    message: 'Global fulfillment results cannot currently be verified. Printify Choice eligibility and delivery coverage are unavailable. You can select Shopify to browse the Lazy Customs store catalog.',
    products: [],
  };
}
