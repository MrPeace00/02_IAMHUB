import {fulfillmentEvidence} from './global-fulfillment-evidence.server.js';

const unavailable = reason => ({state:'unavailable',reason,products:[],
  message:'Global fulfillment results cannot currently be verified. Select Shopify to browse the Lazy Customs store catalog; those results do not verify global delivery.'});

export function createGlobalFulfillment({token=process.env.PRINTIFY_API_TOKEN,
  evidence=fulfillmentEvidence, fetchImplementation=fetch, now=Date.now} = {}) {
  async function json(url, provider=false) {
    const response = await fetchImplementation(url, {
      headers:provider ? {Authorization:`Bearer ${token}`,'User-Agent':'LazyCustoms/verified-fulfillment'} : {},
      signal:AbortSignal.timeout(8000), redirect:'error',
    });
    if (!response.ok) throw new Error('Source unavailable');
    return response.json();
  }
  return async function search({destination} = {}) {
    if (!token || !evidence) return unavailable('eligibility_source_not_configured');
    if (!Number.isFinite(Date.parse(evidence.expires_at)) || Date.parse(evidence.expires_at)<=now() || Date.parse(evidence.observed_at)>now()) return unavailable('evidence_expired');
    if (destination !== undefined && !Object.hasOwn(evidence.destinations,destination)) return {
      state:'unavailable',reason:'destination_unverified',products:[],
      message:'Global Fulfillment is not verified here for that destination. Currently supported verification destinations are United States, Canada, and Australia. This does not mean other countries cannot receive ordinary store orders.',
    };
    try {
      const p = await json(`https://api.printify.com/v1/shops/${evidence.shop_id}/products/${evidence.product_id}.json`,true);
      const variants = (p.variants || []).filter(v=>v.is_enabled);
      const ids = variants.map(v=>v.id).sort((a,b)=>a-b);
      if (p.id!==evidence.product_id || p.blueprint_id!==evidence.blueprint_id || p.print_provider_id!==evidence.print_provider_id ||
          p.updated_at!==evidence.updated_at || !p.visible || String(p.external?.id)!==evidence.shopify_product_id ||
          JSON.stringify(ids)!==JSON.stringify([...evidence.variant_ids].sort((a,b)=>a-b))) return unavailable('product_evidence_changed');
      const url = `https://lazycustoms.com/products/${evidence.handle}`;
      const storefront = await json(`${url}.js`);
      if (String(storefront.id)!==evidence.shopify_product_id || !storefront.available) return unavailable('customer_product_unavailable');
      const availableVariants = variants.filter(v=>v.is_available && storefront.variants?.some(s=>s.sku===v.sku && s.available));
      if (!availableVariants.length) return unavailable('customer_variants_unavailable');
      if (storefront.variants.some(s=>s.available && !availableVariants.some(v=>v.sku===s.sku))) return unavailable('customer_variants_changed');
      if (!destination) return {state:'needs_destination',products:[],
        message:'Which delivery country should I verify for the Global Fulfillment crewneck? Choose a country below. Other products and destinations are not yet verified here.',
        destinations:Object.entries(evidence.destinations).map(([code,{label}])=>({code,label})),
      };
      const shipping = await json(`https://api.printify.com/v1/catalog/blueprints/${p.blueprint_id}/print_providers/${p.print_provider_id}/shipping.json`,true);
      if (!availableVariants.every(v=>shipping.profiles?.some(profile=>profile.countries?.includes(destination) && profile.variant_ids?.includes(v.id)))) return unavailable('destination_coverage_unverified');
      const target = evidence.destinations[destination];
      return {state:'verified',destination,evidence_checked_at:evidence.observed_at,products:[{
        id:`gid://shopify/Product/${storefront.id}`,title:storefront.title,vendor:'Printify',url,
        image_url:storefront.featured_image?.startsWith('//') ? `https:${storefront.featured_image}` : storefront.featured_image || '',
        price:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(storefront.price/100),
        description:`Printify Choice Global Fulfillment to ${target.label}. Estimated delivery: ${target.delivery}.`,
      }],message:`Verified Global Fulfillment option for ${target.label}: ${storefront.title}. Printify’s product confirmation was checked ${evidence.observed_at.slice(0,10)}; product variants and country shipping coverage were rechecked now. Printify estimates ${target.delivery}; this is an estimate, not a guaranteed arrival date. Open the Lazy Customs product page for options and personalization. Checkout confirms the final shipping charge and availability.`};
    } catch { return unavailable('provider_unavailable'); }
  };
}

export async function searchGlobalFulfillment(options) {
  return createGlobalFulfillment()(options);
}
