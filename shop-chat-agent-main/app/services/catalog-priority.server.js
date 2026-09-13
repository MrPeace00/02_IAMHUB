// Enrich UCP results using the same store's public product IDs, never title guesses.
const cache = new Map();
const STORE_ORIGINS = new Set(['https://lazycustoms.com', 'https://www.lazycustoms.com', 'https://vbw9zu-f7.myshopify.com', 'https://lazy-customs-2.myshopify.com']);
const identity = value => String(value || '').replace(/^gid:\/\/shopify\/Product\//, '');

export function createCatalogPriority({ fetchImplementation = fetch, now = Date.now, cacheStore = cache } = {}) {
  async function vendorIndex(origin) {
    if (!STORE_ORIGINS.has(origin)) return new Map();
    const saved = cacheStore.get(origin);
    if (saved && saved.expires > now()) return saved.promise;
    const promise = (async () => {
      const index = new Map();
      // Bounded pagination and timeout; unknown products keep their original order.
      for (let page = 1; page <= 4; page++) {
        const response = await fetchImplementation(`${origin}/products.json?limit=250&page=${page}`, {
          headers: {'User-Agent':'Agent/LazyCustomsChatAssistant'}, signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Vendor metadata unavailable');
        const body = await response.json();
        if (!Array.isArray(body.products)) throw new Error('Invalid vendor metadata');
        for (const p of body.products) index.set(identity(p.id), {vendor:p.vendor});
        if (body.products.length < 250) break;
      }
      return index;
    })().catch(() => new Map());
    cacheStore.set(origin, {promise, expires:now() + 60_000});
    return promise;
  }

  async function prepare(result, origin, preference = 'printify') {
    if (!result || result.isError || result.error) return result;
    const textIndex = result.content?.findIndex(item => item.type === 'text') ?? -1;
    let body = result.structuredContent;
    if (!Array.isArray(body?.products) && textIndex >= 0) {
      try { body = JSON.parse(result.content[textIndex].text); } catch { return result; }
    }
    if (!Array.isArray(body?.products)) return result;
    const vendors = await vendorIndex(origin);
    const products = body.products.map(p => ({...p, ...(vendors.get(identity(p.id)) || {})}));
    const available = p => p.availability?.available !== false && (!p.variants?.length || p.variants.some(v => v.availability?.available !== false));
    // The search tool already applies the buyer's category/price/availability filters.
    // Stable sort preserves relevance within each eligible provider group.
    if (preference !== 'any') products.sort((a,b) => {
      const rank = p => !available(p) ? 2 : /^printify$/i.test(p.vendor || '') ? 0 : 1;
      return rank(a) - rank(b);
    });
    const updated = {...body, products, recommendation_policy: {
      preferred_vendor:preference === 'any' ? null : 'Printify',
      vendor_metadata_available:vendors.size > 0,
      note:'Vendor labels identify catalog grouping only. They do not establish Printify Choice routing, personalization support, or shipping coverage. Honor explicit product choices and customer constraints.',
    }};
    return {...result, structuredContent:updated, content:textIndex < 0 ? result.content : result.content.map((item,i) => i === textIndex ? {...item,text:JSON.stringify(updated)} : item)};
  }
  return {prepare};
}

export function addProviderPreference(tools) {
  return tools.map(tool => tool.name !== 'search_catalog' ? tool : {...tool,
    input_schema:{...tool.input_schema, properties:{...tool.input_schema?.properties,
      provider_preference:{type:'string',enum:['printify','any'],description:'Local recommendation preference. Default printify for general shopping. Use any for an exact product, another provider, explicit price sorting, or when provider priority would conflict with the customer request. This field is handled locally.'},
    }},
  });
}
