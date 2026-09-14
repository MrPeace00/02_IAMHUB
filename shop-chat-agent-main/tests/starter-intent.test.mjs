import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dispatchStarter, validStarterIntent, STARTER_INTENTS, customerProductUrl } from '../app/services/starter-intent.server.js';
import { searchGlobalFulfillment } from '../app/services/global-fulfillment.server.js';
import { createCatalogPriority, addProviderPreference, catalogArgsForRequest, requestedProviderPreference } from '../app/services/catalog-priority.server.js';
import { createSseStream } from '../app/services/streaming.server.js';
import { getCorsHeaders, isAllowedOrigin } from '../app/services/cors.server.js';
import AppConfig from '../app/services/config.server.js';

const sharedProduct = { id: 'p1', title: 'Same shirt', vendor: 'Printify', url: 'https://lazycustoms.com/products/shirt' };

test('intent selects distinct sources and distinct claims from one shared catalog', async () => {
  const calls = [];
  const catalog = [sharedProduct, { ...sharedProduct, id: 'p2', vendor: 'Gelato', url: 'https://lazycustoms.com/products/mug' }];
  const searchShopify = async () => { calls.push('shopify'); return catalog; };
  const searchGlobal = async options => { calls.push('global'); return searchGlobalFulfillment(options); };
  const shop = await dispatchStarter({ intent: 'shopify_catalog', searchShopify, searchGlobal });
  const global = await dispatchStarter({ intent: 'global_fulfillment', searchShopify, searchGlobal });

  assert.deepEqual(calls, ['shopify', 'global', 'shopify']);
  // Shopify browses the whole catalog; global keeps only Printify-made products.
  assert.equal(shop.state, 'catalog');
  assert.deepEqual(shop.products.map(p => p.id), ['p1', 'p2']);
  assert.equal(global.state, 'catalog');
  assert.deepEqual(global.products.map(p => p.id), ['p1']);
  assert.equal(global.fulfillment, 'printify_network');
  assert.notEqual(shop.message, global.message);
});

test('no branch claims verified Choice eligibility, promises delivery, or asks for a country', async () => {
  const messages = [];
  for (const catalog of [[], [{ ...sharedProduct, vendor: '' }], [{ ...sharedProduct, vendor: 'Gelato' }], [sharedProduct]]) {
    const result = await searchGlobalFulfillment({ searchCatalog: async () => catalog });
    messages.push(result.message);
  }
  messages.push((await searchGlobalFulfillment()).message);
  for (const message of messages) {
    assert.doesNotMatch(message, /\b(?:what|which)\s+country\b|\bdelivery country\b|\bcountry\b[^.]*\?/i, message);
    assert.doesNotMatch(message, /guarantee[ds]? (?:worldwide|global)|ships? (?:worldwide|to every country)|verified (?:choice|eligib)/i, message);
  }
  // The one branch that returns products must disclaim the vendor label itself.
  const fulfilled = await searchGlobalFulfillment({ searchCatalog: async () => [sharedProduct] });
  assert.match(fulfilled.message, /does not by itself guarantee Printify Choice routing/);
});

test('unreadable vendor metadata is reported as unreadable, never as "none"', async () => {
  const unreadable = await searchGlobalFulfillment({ searchCatalog: async () => [{ ...sharedProduct, vendor: '' }] });
  assert.equal(unreadable.reason, 'vendor_metadata_unavailable');
  const none = await searchGlobalFulfillment({ searchCatalog: async () => [{ ...sharedProduct, vendor: 'Gelato' }] });
  assert.equal(none.reason, 'no_printify_fulfilled_products');
  assert.notEqual(unreadable.message, none.message);
  for (const result of [unreadable, none]) assert.deepEqual(result.products, []);
});

test('provider errors are sanitized with no cross-catalog fallback', async () => {
  for (const detail of ['timeout', '401', '429', 'malformed JSON']) {
    const result = await dispatchStarter({ intent: 'global_fulfillment',
      searchGlobal: async () => { throw new Error(`${detail}: fixture-secret`); },
      searchShopify: async () => [sharedProduct],
    });
    assert.equal(result.state, 'unavailable');
    assert.deepEqual(result.products, []);
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret|401|429|malformed/);
  }
});

test('only approved customer product URLs survive, canonicalized without redirects', async () => {
  for (const url of ['javascript:alert(1)', 'http://lazycustoms.com/products/shirt',
    'https://printify.com/app/products/1', 'https://lazycustoms.com/admin/products/1',
    'https://lazycustoms.com.evil.test/products/shirt', '//evil.test/products/shirt',
    'https://user:pass@lazycustoms.com/products/shirt', 'https://other.myshopify.com/products/shirt',
    'https://lazycustoms.com/products/%2f%2fevil.test', '', null]) {
    assert.equal(customerProductUrl(url), '', String(url));
  }
  for (const url of ['/products/shirt', 'https://vbw9zu-f7.myshopify.com/products/shirt',
    'https://www.lazycustoms.com/products/shirt?redirect=https://evil.test#admin']) {
    assert.equal(customerProductUrl(url), sharedProduct.url);
  }
  const result = await dispatchStarter({ intent: 'shopify_catalog',
    searchShopify: async () => [sharedProduct, { ...sharedProduct, url: 'https://printify.com/app' }],
    searchGlobal: () => assert.fail('Global source used for Shopify'),
  });
  assert.deepEqual(result.products, [sharedProduct]);
});

test('missing intent keeps general chat; all unknown intent types fail closed', async () => {
  assert.equal(await dispatchStarter({}), null);
  for (const intent of [null, '', 'printify', 'GLOBAL_FULFILLMENT', {}, [], 1]) {
    assert.equal(validStarterIntent(intent), false);
    await assert.rejects(dispatchStarter({ intent }), /Unsupported starter intent/);
  }
  assert.deepEqual(STARTER_INTENTS, ['global_fulfillment', 'shopify_catalog']);
});

function routeHarness() {
  const calls = [];
  const saved = [];
  const toolSource = readFileSync(new URL('../app/services/tool.server.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function').replace(/export default.*;/, '');
  const routeSource = readFileSync(new URL('../app/routes/chat.jsx', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export async function/g, 'async function');
  const context = vm.createContext({ URL, Response, console, Intl, AppConfig,
    validStarterIntent, dispatchStarter, createSseStream, getCorsHeaders, isAllowedOrigin,
    addProviderPreference, catalogArgsForRequest, requestedProviderPreference,
    createCatalogPriority: () => createCatalogPriority({ cacheStore: new Map(), fetchImplementation: async () => ({
      ok: true, json: async () => ({ products: [{ id: 'p1', vendor: 'Printify' }] }),
    }) }),
    saveMessage: async (...args) => saved.push(args),
    getConversationHistory: async () => saved.map(([, role, content]) => ({ role, content })),
    getCustomerAccountUrlsFromDb: async () => ({ mcpApiUrl: 'https://lazycustoms.com/customer/api/mcp' }),
    createAIService: () => {
      calls.push('general');
      return { provider: 'openai', formatHistory: messages => messages,
        service: { streamResponse: async (options, { onText }) => {
          onText('An ordinary chat response');
          return { functionCalls: [] };
        } },
      };
    },
    MCPClient: class {
      constructor() { calls.push('mcp'); this.tools = []; }
      async connectToStorefrontServer() { calls.push('connect'); return []; }
      async connectToCustomerServer() { return []; }
      async callTool(name, args) {
        calls.push({ name, args });
        return { structuredContent: { products: [sharedProduct] } };
      }
    },
  });
  vm.runInContext(toolSource + routeSource + '\nglobalThis.action = action;', context);
  return { calls, saved, async post(body) {
    return context.action({ request: new Request('https://chat.example.com/chat', {
      method: 'POST', headers: { Origin: 'https://lazycustoms.com', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) });
  } };
}

test('POST /chat dispatches both starters before any AI, and keeps the SSE contract', async () => {
  const harness = routeHarness();
  const request = { message: 'Same shirt', conversation_id: 'same-conversation' };
  const catalogCall = { name: 'search_catalog', args: { catalog: { query: '' } } };

  const global = await harness.post({ ...request, intent: 'global_fulfillment' });
  const globalEvents = (await global.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
  assert.equal(global.status, 200);
  // Global fulfillment reads the one real catalog. What it must not do is
  // reach the AI loop or customer-account discovery before choosing a source.
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls)), ['mcp', 'connect', catalogCall]);
  const globalResult = globalEvents.find(event => event.type === 'starter_result');
  assert.equal(globalResult.state, 'catalog');
  assert.equal(globalResult.fulfillment, 'printify_network');
  assert.equal(globalEvents.find(event => event.type === 'product_results').products[0].url, sharedProduct.url);
  assert.equal(globalEvents.at(-1).type, 'end_turn');
  assert.equal(harness.saved.length, 2);

  const shop = await harness.post({ ...request, intent: 'shopify_catalog' });
  const shopEvents = (await shop.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls)), ['mcp', 'connect', catalogCall, 'mcp', 'connect', catalogCall]);
  const shopResult = shopEvents.find(event => event.type === 'starter_result');
  assert.equal(shopResult.state, 'catalog');
  assert.equal(shopResult.fulfillment, undefined);
  assert.notEqual(shopResult.message, globalResult.message);
  assert.equal(shopEvents.find(event => event.type === 'product_results').products[0].url, sharedProduct.url);

  // Neither starter touches the AI service; intent applies to this request only.
  assert.equal(harness.calls.filter(call => call === 'general').length, 0);
  const freeForm = await (await harness.post(request)).text();
  assert.match(freeForm, /An ordinary chat response/);
  assert.doesNotMatch(freeForm, /starter_result/);
  assert.equal(harness.calls.filter(call => call === 'general').length, 1);
});

test('POST /chat rejects unknown intents and invalid messages before any source call', async () => {
  for (const body of [null, { message: 'shirt', intent: 'unknown' }, { message: 'shirt', intent: null },
    { message: {}, intent: 'global_fulfillment' }, { message: ' ', intent: 'shopify_catalog' }]) {
    const harness = routeHarness();
    assert.equal((await harness.post(body)).status, 400);
    assert.deepEqual(harness.calls, []);
  }
});
