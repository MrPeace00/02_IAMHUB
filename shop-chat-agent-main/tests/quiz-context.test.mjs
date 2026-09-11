import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function loadBuildQuizContext() {
  const source = readFileSync(new URL('../app/routes/chat.jsx', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export async function/g, 'async function');
  const context = vm.createContext({});
  vm.runInContext(source + '\nglobalThis.buildQuizContext = buildQuizContext;', context);
  return context.buildQuizContext;
}

test('quiz context includes only whitelisted, sanitized fields', () => {
  const buildQuizContext = loadBuildQuizContext();

  const context = buildQuizContext({
    name: '  Alex  ',
    age: '6',
    audience: 'child',
    season: 'winter',
    category: 'hoodie',
  });

  assert.match(context, /name: Alex/);
  assert.match(context, /age: 6/);
  assert.match(context, /audience: child/);
  assert.match(context, /season: winter/);
  assert.match(context, /category: hoodie/);
});

test('quiz context rejects out-of-range age and unknown audience/season values', () => {
  const buildQuizContext = loadBuildQuizContext();

  const context = buildQuizContext({
    age: '999',
    audience: '<script>alert(1)</script>',
    season: 'monsoon',
  });

  assert.doesNotMatch(context, /audience:/);
  assert.doesNotMatch(context, /season:/);
  assert.match(context, /age: 120/);
});

test('quiz context is empty for missing or empty quiz input', () => {
  const buildQuizContext = loadBuildQuizContext();

  assert.equal(buildQuizContext(undefined), '');
  assert.equal(buildQuizContext(null), '');
  assert.equal(buildQuizContext({}), '');
});
