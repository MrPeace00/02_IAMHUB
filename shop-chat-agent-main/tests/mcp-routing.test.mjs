import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Isolate transport from database/auth modules; exercise the actual client source.
const source = readFileSync(new URL('../app/mcp-client.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default MCPClient;', 'globalThis.Client = MCPClient;');
const tool = name => ({ name, description: name, inputSchema: { type: 'object' } });
function setup(legacy = ['get_cart', 'update_cart', 'search_shop_policies_and_faqs']) {
  const calls = [];
  const context = vm.createContext({ URL, Map, Set, process: { env: {} }, console,
    getCustomerToken: async () => null,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, options, body });
      const tools = url.endsWith('/api/ucp/mcp')
        ? ['search_catalog', 'lookup_catalog', 'get_product', 'get_cart', 'create_cart', 'update_cart', 'complete_checkout'] : legacy;
      return { ok: true, json: async () => body.method === 'tools/list'
        ? { result: { tools: tools.map(tool) } } : { result: { content: [{ type: 'text', text: 'ok' }] } } };
    }
  });
  vm.runInContext(source, context);
  return { client: new context.Client('https://store.myshopify.com/', null, null), calls, context };
}
test('catalog metadata, standard cart/policy routing and reconnect deduplication', async () => {
  const { client, calls } = setup();
  await client.connectToStorefrontServer();
  await client.connectToStorefrontServer();
  assert.equal(client.tools.length, new Set(client.tools.map(t => t.name)).size);
  for (const name of ['search_catalog', 'lookup_catalog', 'get_product']) {
    await client.callTool(name, { catalog: { query: 'test' } });
    const call = calls.at(-1);
    assert.ok(call.url.endsWith('/api/ucp/mcp'));
    assert.ok(call.body.params.arguments.meta['ucp-agent'].profile);
    assert.equal(call.body.params.meta, undefined);
  }
  for (const name of ['get_cart', 'update_cart', 'search_shop_policies_and_faqs']) {
    await client.callTool(name, { query: 'test' });
    assert.ok(calls.at(-1).url.endsWith('/api/mcp'));
    assert.equal(calls.at(-1).body.params.arguments.meta, undefined);
  }
  assert.ok(calls.filter(c => c.body.method === 'tools/list' && c.url.includes('/ucp/'))
    .every(c => c.body.params.arguments.meta['ucp-agent'].profile));
  assert.ok(calls.every(c => c.options.headers['User-Agent'] === 'Agent/LazyCustomsChatAssistant'));
  await assert.rejects(client.callStorefrontTool('unknown', {}), /not been discovered/);
});
test('live-store shape: UCP carts when standard MCP only exposes policies', async () => {
  const { client, calls } = setup(['search_shop_policies_and_faqs']);
  await client.connectToStorefrontServer();
  await client.callTool('update_cart', { cart: { id: 'example' } });
  assert.ok(calls.at(-1).url.endsWith('/api/ucp/mcp'));
  assert.equal(calls.at(-1).body.params.arguments.cart.id, 'example');
  assert.ok(calls.at(-1).body.params.arguments.meta);
  assert.ok(!client.tools.some(t => t.name === 'complete_checkout'));
});
test('JSON-RPC errors are failures, and an endpoint outage does not hide the other endpoint', async () => {
  const { client, context } = setup();
  const original = context.fetch;
  context.fetch = async (url, options) => url.endsWith('/api/mcp')
    ? { ok: true, json: async () => ({ error: { code: -32603, message: 'unavailable' } }) }
    : original(url, options);
  await assert.rejects(client._makeJsonRpcRequest('https://store/api/mcp', 'tools/list', {}, {}), /unavailable/);
  await client.connectToStorefrontServer();
  assert.ok(client.tools.some(t => t.name === 'search_catalog'));
});
test('UCP structured products and tool errors reach conversation history', async () => {
  const text = readFileSync(new URL('../app/services/tool.server.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function').replace(/export default \{[\s\S]*$/, 'globalThis.service = createToolService();');
  const context = vm.createContext({ console, Intl, AppConfig: { tools: { productSearchName: 'search_catalog', maxProductsToDisplay: 3 } }, saveMessage: async () => {} });
  vm.runInContext(text, context);
  const response = { structuredContent: { products: [{ id: 'p1', title: 'Test', price_range: { min: { amount: 1899, currency: 'USD' } }, media: [{ type: 'image', url: 'https://example.com/image' }] }] } };
  const history = [], products = [];
  await context.service.handleToolSuccess(response, 'search_catalog', 't1', history, products, null);
  assert.equal(products[0].price, '$18.99');
  assert.equal(products[0].id, 'p1');
  assert.ok(history[0].content[0].content.includes('products'));
  await context.service.handleToolSuccess({ isError: true, content: [{ type: 'text', text: 'failed' }] }, 'search_catalog', 't2', history, products, null);
  assert.equal(history[1].content[0].is_error, true);
  assert.equal(products.length, 1);
});
