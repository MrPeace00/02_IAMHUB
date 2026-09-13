import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { STARTER_INTENTS } from '../app/services/starter-intent.server.js';

class Element {
  constructor() {
    this.children = [];
    this.events = {};
    this.dataset = {};
    this.value = '';
    this.classList = { add() {}, remove() {} };
  }
  addEventListener(event, handler) { this.events[event] = handler; }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  focus() {}
  scrollIntoView() {}
  click() { return this.events.click?.(); }
}

test('homepage buttons and suggestion chips send distinct intents; ordinary chat does not inherit', async () => {
  const elements = new Map();
  const root = new Element();
  root.dataset.backendUrl = 'https://chat.example.com';
  root.querySelector = selector => {
    if (selector === '[data-lazy-quiz-form]') return null;
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  root.querySelectorAll = () => [];
  const requests = [];
  const context = vm.createContext({ URL, TextDecoder, console,
    window: { location: { origin: 'https://lazycustoms.com', hostname: 'lazycustoms.com' }, addEventListener() {} },
    sessionStorage: { getItem: () => 'session', setItem() {} },
    document: { readyState: 'complete', createElement: () => new Element(), querySelectorAll: () => [root] },
    fetch: async (url, options) => {
      if (url.endsWith('?health=true')) return { ok: true };
      const body = JSON.parse(options.body);
      requests.push({ url, options, body });
      const events = [
        { type: 'starter_result', intent: body.intent, state: body.intent === 'global_fulfillment' ? 'unavailable' : 'catalog' },
        { type: 'chunk', chunk: 'Results' }, { type: 'product_results', products: [] },
      ];
      return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
    },
  });
  const source = readFileSync(new URL('../extensions/chat-bubble/assets/lazy-home.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.homeIntents = STARTER_INTENTS;\n})();'), context);
  assert.deepEqual(Array.from(context.homeIntents), STARTER_INTENTS);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const initialChips = [...elements.get('[data-lazy-chips]').children];
  // Dedicated starters and both initial suggestion chips must use the same contract.
  for (const selector of ['[data-lazy-global-start]', '[data-lazy-shopify-start]']) {
    elements.get(selector).click();
    await settle();
  }
  for (const chip of initialChips.slice(0, 2)) {
    chip.click();
    await settle();
  }
  elements.get('[data-lazy-input]').value = 'An ordinary question';
  elements.get('[data-lazy-form]').events.submit({ preventDefault() {} });
  await settle();
  assert.deepEqual(requests.map(request => request.body.intent), [
    'global_fulfillment', 'shopify_catalog', 'global_fulfillment', 'shopify_catalog', undefined,
  ]);
  assert.ok(requests.every(request => request.url === 'https://chat.example.com/chat' && request.options.method === 'POST'));
  const assistantMessages = elements.get('[data-lazy-messages]').children.filter(element => element.dataset.starterIntent);
  assert.equal(assistantMessages.length, 4);
  assert.equal(assistantMessages[0].dataset.verificationState, 'unavailable');
  assert.equal(elements.get('[data-lazy-products]').children.length, 0);
});

test('public theme assets contain no server-side Printify credential references', () => {
  for (const path of ['assets/chat.js', 'assets/lazy-home.js', 'blocks/chat-interface.liquid', 'blocks/lazy-home.liquid']) {
    const source = readFileSync(new URL(`../extensions/chat-bubble/${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /PRINTIFY_API_TOKEN|PRINTIFY_API_KEY|Bearer\s+|fixture-secret/);
  }
});
