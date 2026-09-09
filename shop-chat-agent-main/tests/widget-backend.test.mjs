import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCorsHeaders, isAllowedOrigin } from '../app/services/cors.server.js';

function widget(appUrl, fetch) {
  const source = readFileSync(new URL('../extensions/chat-bubble/assets/chat.js', import.meta.url), 'utf8')
    .replace('  // Initialize the application when DOM is ready', '  globalThis.widget = ShopAIChat;\n  // Initialize the application when DOM is ready');
  const context = vm.createContext({ window: { shopChatConfig: { appUrl } },
    document: { addEventListener() {} }, URL, AbortController, setTimeout, clearTimeout, fetch });
  vm.runInContext(source, context);
  return context.widget;
}
test('valid backend is normalized and checked before use', async () => {
  const app = widget(' https://chat.example.com/ ', async url => {
    assert.equal(url, 'https://chat.example.com/chat?health=true');
    return { ok: true, json: async () => ({ service: 'shop-chat-agent', status: 'ok' }) };
  });
  await app.configureBackend();
  assert.equal(app.APP_URL, 'https://chat.example.com');
});
test('missing or invalid backend never falls back to localhost or sends requests', async () => {
  for (const url of ['', 'not a URL', 'http://chat.example.com', 'https://chat.example.com/chat', 'https://user:pass@chat.example.com']) {
    const app = widget(url, () => assert.fail('Unexpected network request'));
    await assert.rejects(app.configureBackend());
  }
});
test('dead tunnels and unrelated servers fail the backend check', async () => {
  for (const fetch of [async () => { throw new Error('ENOTFOUND'); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => ({ status: 'ok' }) })]) {
    await assert.rejects(widget('https://chat.example.com', fetch).configureBackend());
  }
});
test('health route is CORS-enabled and does not invoke chat services', async () => {
  const source = readFileSync(new URL('../app/routes/chat.jsx', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export async function/g, 'async function');
  const context = vm.createContext({ URL, Response, getCorsHeaders, isAllowedOrigin });
  vm.runInContext(source + '\nglobalThis.loader = loader;', context);
  const response = await context.loader({ request: new Request('https://chat.example.com/chat?health=true', {
    headers: { Origin: 'https://lazycustoms.com' }
  }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://lazycustoms.com');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { service: 'shop-chat-agent', status: 'ok' });
});

test('chat CORS rejects unlisted storefront origins', async () => {
  const source = readFileSync(new URL('../app/routes/chat.jsx', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export async function/g, 'async function');
  const context = vm.createContext({ URL, Response, getCorsHeaders, isAllowedOrigin });
  vm.runInContext(source + '\nglobalThis.loader = loader;', context);
  const response = await context.loader({ request: new Request('https://chat.example.com/chat?health=true', {
    headers: { Origin: 'https://attacker.example' }
  }) });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
