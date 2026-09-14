#!/usr/bin/env node
// Read-only discovery for the Global fulfillment eligibility gate.
//
// Why this exists: global-fulfillment.server.js can currently only say a
// product is *made* by Printify (from Shopify vendor metadata). To say whether
// a product is Printify Choice eligible and where it can be delivered, we need
// the real field names on Printify's own product objects. Those must be read
// from the live API, never guessed.
//
// This script issues GET requests only. It never writes, never submits an
// order, and never prints the token or any recipient/address data.
//
//   1. Put PRINTIFY_API_TOKEN=<token> on its own line in .env (gitignored).
//   2. node scripts/inspect-printify-catalog.mjs
//
// Give the output to Champion; it is the evidence needed to implement verified
// eligibility and to close the gate in STARTER_INTENTS.md.

import { readFileSync } from 'node:fs';

const BASE = 'https://api.printify.com/v1';

// Prefer .env over an environment variable. A Printify token is ~900 characters
// and shell quoting rules differ per shell; putting it in .env (which
// .gitignore already covers) avoids that entirely and keeps it out of shell
// history. The environment variable still wins if it is set.
function tokenFromEnvFile() {
  const path = new URL('../.env', import.meta.url);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return '';
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, '');
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    if (line.slice(0, separator).trim() !== 'PRINTIFY_API_TOKEN') continue;
    return line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/s, '$2').trim();
  }
  return '';
}

const token = (process.env.PRINTIFY_API_TOKEN || tokenFromEnvFile()).trim();

if (!token) {
  console.error([
    'No Printify token found.',
    '',
    'Put it in the .env file next to package.json, on its own line:',
    '',
    '  PRINTIFY_API_TOKEN=your-token-here',
    '',
    'No quotes needed. .env is already in .gitignore, so it is never committed.',
    'Then re-run: node scripts/inspect-printify-catalog.mjs',
  ].join('\n'));
  process.exit(1);
}

// Any key whose name suggests a person or an address is never printed.
const SENSITIVE = /address|recipient|email|phone|first_name|last_name|customer|token|secret|key/i;

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': 'LazyCustoms/catalog-discovery' },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${path} -> HTTP ${response.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text || '{}');
}

// Report the shape: key name, type, and a short value only for scalars that
// are not sensitive. Nested objects are described, not dumped.
function describe(value, prefix = '') {
  const rows = [];
  for (const [key, raw] of Object.entries(value ?? {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (SENSITIVE.test(key)) { rows.push(`${name}: <redacted>`); continue; }
    if (raw === null) rows.push(`${name}: null`);
    else if (Array.isArray(raw)) {
      rows.push(`${name}: array(${raw.length})`);
      if (raw.length && typeof raw[0] === 'object') rows.push(...describe(raw[0], `${name}[0]`));
    } else if (typeof raw === 'object') rows.push(...describe(raw, name));
    else rows.push(`${name}: ${typeof raw} = ${JSON.stringify(raw).slice(0, 80)}`);
  }
  return rows;
}

async function main() {
  const shops = await get('/shops.json');
  console.log(`shops: ${shops.length}`);
  for (const shop of shops) console.log(`  id=${shop.id} title=${JSON.stringify(shop.title)} channel=${shop.sales_channel}`);

  const shop = shops[0];
  if (!shop) { console.log('No shops on this token; nothing further to inspect.'); return; }

  const page = await get(`/shops/${encodeURIComponent(shop.id)}/products.json?limit=5`);
  const products = Array.isArray(page.data) ? page.data : [];
  console.log(`\nproducts on shop ${shop.id}: ${page.total ?? products.length} (showing shape of 1)`);
  if (!products.length) { console.log('No products returned.'); return; }

  console.log('\n--- product object shape ---');
  for (const row of describe(products[0])) console.log(row);

  console.log('\n--- keys that may carry eligibility / coverage ---');
  const flat = describe(products[0]);
  const candidates = flat.filter(row => /eligib|express|economy|choice|shipping|provider|country|region|external/i.test(row));
  console.log(candidates.length ? candidates.join('\n') : 'None matched. Report this result; it is itself evidence.');
}

try {
  await main();
} catch (error) {
  // A stack trace helps nobody here. Say what failed and what to check.
  console.error(`\nDiscovery failed: ${error.message}`);
  if (/HTTP 401/.test(error.message)) {
    console.error('The token was rejected. Check that it is current and has catalog/product read scope.');
  } else if (/HTTP 403/.test(error.message)) {
    // A 403 here is ambiguous: Printify refusing the token, or a network proxy
    // refusing the host. The response text above distinguishes them.
    console.error('Forbidden. Either the token lacks the needed scope, or a network proxy is blocking api.printify.com -- the response text above says which.');
  } else if (/fetch failed|ENOTFOUND|ETIMEDOUT|timeout/i.test(error.message)) {
    console.error('api.printify.com could not be reached from this machine or network.');
  }
  process.exit(1);
}
