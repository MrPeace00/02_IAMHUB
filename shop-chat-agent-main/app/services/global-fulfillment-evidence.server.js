// Human-observed Printify confirmation. Re-observe before extending expiry.
// 2026-09-15: expiry re-armed on operator (Mr. Peace) attestation that the
// Global Fulfillment product is unchanged. Product/variant/shipping are still
// re-verified live against Printify at request time; a real change is caught
// there (product_evidence_changed / customer_* / destination_coverage_unverified).
export const fulfillmentEvidence = {
  observed_at:'2026-09-15T04:53:00Z', expires_at:'2026-09-16T04:53:00Z',
  source:'https://printify.com/app/product-details/6a7769c211b5d6d7cb0c60bd?fromProductsPage=1',
  observation:'Published product displays “You’re saving time and money with Global Fulfillment!” and the Global Fulfillment costs & delivery table.',
  shop_id:28517701, product_id:'6a7769c211b5d6d7cb0c60bd', blueprint_id:49, print_provider_id:99,
  updated_at:'2026-08-08 17:46:09+00:00', shopify_product_id:'10446334558530',
  handle:'crewneck-sweatshirt-abstract-brown-geometric-pattern',
  variant_ids:[25520,25396,25427,25489,25458,25551],
  destinations:{
    US:{label:'United States',delivery:'2–5 business days'},
    CA:{label:'Canada',delivery:'2–5 business days'},
    AU:{label:'Australia',delivery:'3–6 business days'},
  },
  exclusions:'UK excluded: live v1 shipping profiles lack explicit GB coverage. EU excluded pending store compliance confirmation. Other destinations not approved.',
};
