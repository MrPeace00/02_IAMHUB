import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCorsHeaders, isAllowedOrigin } from '../app/services/cors.server.js';

test('generation CORS uses an exact production allowlist', () => {
  const allowed = new Request('https://ai.lazycustoms.com/generate-image', {
    headers: { Origin: 'https://lazycustoms.com' }
  });
  const lookalike = new Request('https://ai.lazycustoms.com/generate-image', {
    headers: { Origin: 'https://lazycustoms.com.attacker.example' }
  });
  assert.equal(isAllowedOrigin(allowed), true);
  assert.equal(getCorsHeaders(allowed)['Access-Control-Allow-Origin'], 'https://lazycustoms.com');
  assert.equal(isAllowedOrigin(lookalike), false);
  assert.equal(getCorsHeaders(lookalike)['Access-Control-Allow-Origin'], undefined);
});

test('generation route pins the requested image model and returns PNG bytes', () => {
  const source = readFileSync(new URL('../app/routes/generate-image.jsx', import.meta.url), 'utf8');
  assert.match(source, /model: "gpt-image-2\.5-flare"/);
  assert.match(source, /Buffer\.from\(base64Image, "base64"\)/);
  assert.match(source, /"Content-Type": "image\/png"/);
  assert.match(source, /enforceGenerationRateLimit/);
});

test('homepage extension assets parse and expose the minimal AI surface', () => {
  const script = readFileSync(new URL('../extensions/chat-bubble/assets/lazy-home.js', import.meta.url), 'utf8');
  const liquid = readFileSync(new URL('../extensions/chat-bubble/blocks/lazy-home.liquid', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(script));
  assert.match(liquid, /"target": "section"/);
  assert.match(liquid, /"templates": \["index"\]/);
  assert.match(liquid, /data-lazy-form/);
});
