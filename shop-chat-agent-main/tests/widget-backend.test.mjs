import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCorsHeaders, isAllowedOrigin } from '../app/services/cors.server.js';

function widget(appUrl, fetch, documentOverrides = {}) {
  const source = readFileSync(new URL('../extensions/chat-bubble/assets/chat.js', import.meta.url), 'utf8')
    .replace('  // Initialize the application when DOM is ready', '  globalThis.widget = ShopAIChat;\n  // Initialize the application when DOM is ready');
  const context = vm.createContext({ window: { shopChatConfig: { appUrl } },
    document: { addEventListener() {}, ...documentOverrides }, sessionStorage: { getItem() { return null; } }, console,
    URL, AbortController, setTimeout, clearTimeout, fetch });
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

test('shopping starters lead with global fulfillment and keep Shopify as the store catalog', () => {
  const homeLiquid = readFileSync(new URL('../extensions/chat-bubble/blocks/lazy-home.liquid', import.meta.url), 'utf8');
  const chatLiquid = readFileSync(new URL('../extensions/chat-bubble/blocks/chat-interface.liquid', import.meta.url), 'utf8');
  const homeScript = readFileSync(new URL('../extensions/chat-bubble/assets/lazy-home.js', import.meta.url), 'utf8');
  const chatScript = readFileSync(new URL('../extensions/chat-bubble/assets/chat.js', import.meta.url), 'utf8');

  for (const source of [homeLiquid, chatLiquid]) {
    assert.ok(source.indexOf('Global fulfillment') < source.indexOf('Shopify'));
    assert.doesNotMatch(source, /Shopify search/i);
  }
  for (const source of [homeScript, chatScript]) {
    assert.match(source, /Check verified Printify Choice global fulfillment options/);
    assert.match(source, /Shopify catalog from any provider/);
  }
});

test('shopping requests stay locked until the stream settles, including failures', async () => {
  for (const fail of [false, true]) {
    const app = widget('https://chat.example.com', () => {});
    const input = { value: 'Shopify catalog', disabled: false };
    let requests = 0;
    let finish;
    app.UI.setBusy = busy => { input.disabled = busy; };
    app.UI.showTypingIndicator = () => {};
    app.UI.removeTypingIndicator = () => {};
    app.Message.add = () => {};
    app.API.streamResponse = () => {
      requests++;
      return new Promise((resolve, reject) => { finish = () => fail ? reject(new Error('offline')) : resolve(); });
    };
    const pending = app.Message.send(input, {});
    assert.equal(input.disabled, true);
    input.value = 'Global fulfillment';
    await app.Message.send(input, {});
    assert.equal(requests, 1);
    finish();
    await pending;
    assert.equal(input.disabled, false);
    assert.equal(app.Message.busy, false);
  }
});

test('partial Markdown stays hidden and is formatted once without token scrolling', () => {
  const app = widget('https://chat.example.com', () => {});
  const element = { dataset: { rawText: '' }, hidden: true, textContent: '' };
  Object.defineProperty(element, 'innerHTML', {
    set(value) { this.html = value; this.textContent = value; },
  });
  let scrolls = 0;
  app.UI.scrollToBottom = () => { scrolls++; };
  app.UI.removeTypingIndicator = () => {};
  for (const chunk of ['## Products\n', '[A shirt](https://lazycustoms.com/products/', 'shirt)\n<script>bad</script>']) {
    app.API.handleStreamEvent({ type: 'chunk', chunk }, element);
    assert.equal(element.hidden, true);
    assert.equal(element.textContent, '');
  }
  assert.equal(scrolls, 0);
  app.API.handleStreamEvent({ type: 'message_complete' }, element);
  assert.equal(element.hidden, false);
  assert.match(element.html, /<a href="https:\/\/lazycustoms.com\/products\/shirt"/);
  assert.doesNotMatch(element.html, /##|<script>/);
  assert.equal(scrolls, 1);
});

test('stream errors reveal a stable message without retaining partial output', () => {
  const app = widget('https://chat.example.com', () => {});
  app.UI.removeTypingIndicator = () => {};
  const element = { dataset: { rawText: 'unfinished' }, hidden: true };
  app.API.handleStreamEvent({ type: 'error', error: 'offline' }, element);
  assert.equal(element.hidden, false);
  assert.equal(element.dataset.rawText, '');
  assert.match(element.textContent, /Please try again/);
});

test('both widget buttons send their intent over POST; later free-form requests omit it', async () => {
  const buttons = Object.fromEntries(['[data-shop-ai-global]', '[data-shop-ai-shopify]'].map(key => [key, {
    addEventListener(event, handler) { this.click = handler; },
  }]));
  const container = { dataset: {}, querySelector: selector => buttons[selector] };
  const requests = [];
  const app = widget('https://chat.example.com', async (url, options) => {
    requests.push({ url, method: options.method, body: JSON.parse(options.body) });
    // Stop after the network boundary: rendering is covered separately.
    return { ok: false };
  }, { querySelector: () => container });
  const chatInput = { value: '', disabled: false };
  const sendButton = { disabled: false };
  app.APP_URL = 'https://chat.example.com';
  app.configureBackend = async () => {};
  app.UI.init = () => { app.UI.elements = { chatInput, sendButton, messagesContainer: {} }; };
  app.UI.setBusy = busy => { chatInput.disabled = busy; sendButton.disabled = busy; };
  app.UI.showTypingIndicator = app.UI.removeTypingIndicator = () => {};
  app.Message.add = () => {};
  await app.init();
  for (const selector of Object.keys(buttons)) {
    buttons[selector].click();
    await new Promise(resolve => setImmediate(resolve));
  }
  chatInput.value = 'An ordinary question';
  await app.Message.send(chatInput, {});
  assert.deepEqual(requests.map(request => request.body.intent), ['global_fulfillment', 'shopify_catalog', undefined]);
  assert.ok(requests.every(request => request.method === 'POST' && request.url === 'https://chat.example.com/chat'));
  assert.ok(requests.every(request => typeof request.body.message === 'string' && request.body.prompt_type));
  assert.deepEqual(Array.from(app.API.STARTER_INTENTS), ['global_fulfillment', 'shopify_catalog']);
});

test('widget country selection retains global intent and sends structured destination', async () => {
  const children=[];
  const app=widget('https://chat.example.com',()=>{}, {createElement:()=>({
    appendChild(child){children.push(child);},addEventListener(event,handler){this.click=handler;},remove(){},
  })});
  app.UI.elements={chatInput:{value:''},messagesContainer:{appendChild(){}}};
  let sent;
  app.Message.send=(input,container,intent,destination)=>{sent={intent,destination,message:input.value};};
  app.API.handleStreamEvent({type:'starter_result',intent:'global_fulfillment',state:'needs_destination',
    destinations:[{code:'CA',label:'Canada'}]}, {dataset:{}});
  children[0].click();
  assert.equal(sent.intent,'global_fulfillment');
  assert.equal(sent.destination,'CA');
  assert.match(sent.message,/Canada/);
});
