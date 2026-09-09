import { readFile } from 'node:fs/promises';

// Read-only checks: no carts, orders, customer data, or AI requests.
const store = new URL(process.argv[2] || 'https://lazycustoms.com').origin;
const config = await readFile(new URL('../shopify.app.toml', import.meta.url), 'utf8');
const configuredBackend = config.match(/^application_url\s*=\s*"([^"]+)"/m)?.[1];
const profile = process.env.UCP_AGENT_PROFILE_URL ||
  'https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json';
const report = { checkedAt: new Date().toISOString(), store, searches: [] };
async function get(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}
try {
  const response = await get(store);
  const html = await response.text();
  // Read only the published appUrl JSON string; never evaluate storefront scripts.
  const value = html.match(/window\.shopChatConfig\s*=\s*\{[^}]*appUrl:\s*("(?:\\.|[^"\\])*")/);
  report.publishedBackend = value ? JSON.parse(value[1]) : null;
  report.storefrontStatus = response.status;
} catch (error) { report.storefrontError = error.message; }
for (const [label, backend] of Object.entries({ configuredBackend, publishedBackend: report.publishedBackend })) {
  if (!backend) { report[label + 'Check'] = { error: 'No backend configured' }; continue; }
  try {
    const response = await get(new URL('/chat?health=true', backend), { headers: { Origin: store } });
    const body = await response.json().catch(() => null);
    report[label + 'Check'] = { url: backend, httpStatus: response.status,
      reachable: response.ok && body?.service === 'shop-chat-agent' && body?.status === 'ok',
      corsOrigin: response.headers.get('access-control-allow-origin') };
  } catch (error) {
    report[label + 'Check'] = { url: backend, reachable: false, error: error.cause?.code || error.message };
  }
}
for (const query of ['baby', 'shirt', 'hoodie', '']) {
  try {
    const response = await get(`${store}/api/ucp/mcp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Agent/LazyCustomsChatAssistant' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'search_catalog', arguments: { meta: { 'ucp-agent': { profile } }, catalog: { query } }
      } })
    });
    const rpc = await response.json();
    const data = rpc.result?.structuredContent || JSON.parse(rpc.result?.content?.find(item => item.type === 'text')?.text || '{}');
    report.searches.push({ query, httpStatus: response.status, error: rpc.error,
      isError: rpc.result?.isError, status: data.ucp?.status, count: data.products?.length,
      messages: data.messages, hasNextPage: data.pagination?.has_next_page });
  } catch (error) { report.searches.push({ query, error: error.message }); }
}
console.log(JSON.stringify(report, null, 2));
if (!report.publishedBackendCheck?.reachable || report.searches.some(result =>
  result.error || result.isError || result.status !== 'success')) process.exitCode = 1;
