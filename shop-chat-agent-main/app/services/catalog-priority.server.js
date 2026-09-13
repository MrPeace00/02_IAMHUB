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
    let products = body.products.map(p => ({...p, ...(vendors.get(identity(p.id)) || {})}));
    if (preference === 'exclude_printify') products = products.filter(p => p.vendor && !/^printify$/i.test(p.vendor));
    const available = p => p.availability?.available !== false && (!p.variants?.length || p.variants.some(v => v.availability?.available !== false));
    // The search tool already applies the buyer's category/price/availability filters.
    // Stable sort preserves relevance within each eligible provider group.
    if (preference === 'printify') products.sort((a,b) => {
      const rank = p => !available(p) ? 2 : /^printify$/i.test(p.vendor || '') ? 0 : 1;
      return rank(a) - rank(b);
    });
    const updated = {...body, products, recommendation_policy: {
      preferred_vendor:preference === 'printify' ? 'Printify' : null,
      excluded_vendor:preference === 'exclude_printify' ? 'Printify' : null,
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
      provider_preference:{type:'string',enum:['printify','any','exclude_printify'],description:'Local recommendation preference. Default printify for general shopping. Use exclude_printify when the buyer refuses Printify. Use any for an exact product, explicit price sorting, or when provider priority would conflict with the customer request. This field is handled locally.'},
    }},
  });
}

export function requestedProviderPreference(message, preference) {
  const text = message || '';
  if (/\b(?:not|no|exclude|excluding|except|without)\s+printify\b|\bnon[- ]printify\b|\b(?:another|other|different)\s+(?:print\s+)?provider\b/i.test(text)) {
    return 'exclude_printify';
  }
  if (/\b(?:any|all)\s+(?:print\s+)?providers?\b/i.test(text)) return 'any';
  return preference;
}

export function catalogArgsForRequest(message, args = {}) {
  const {provider_preference = 'printify', ...catalogArgs} = args || {};
  const genericBrowse = /^\s*(?:what do you (?:have|sell|offer)|show me what you (?:have|sell|offer)|(?:show me |browse |shop )?(?:all )?(?:your )?(?:products|catalog|store|shop)|browse|shop)\s*[?.!]*\s*$/i.test(message || '');
  if (!genericBrowse) return {providerPreference:provider_preference, catalogArgs};
  return {
    providerPreference:provider_preference,
    catalogArgs:{...catalogArgs, catalog:{...(catalogArgs.catalog || {}), query:''}},
  };
}
