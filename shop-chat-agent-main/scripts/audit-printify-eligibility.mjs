// Read-only provider evidence collection. Never emits credentials or order/customer data.
import 'dotenv/config';
import {writeFile} from 'node:fs/promises';

const outputPath = new URL('../printify-eligibility-audit.json', import.meta.url);

const token = process.env.PRINTIFY_API_TOKEN;
const evidence = {checked_at:new Date().toISOString(), source:'https://api.printify.com/v1', shops:[]};
async function get(path) {
  const response = await fetch(`${evidence.source}${path}`, {
    headers:{Authorization:`Bearer ${token}`, 'User-Agent':'LazyCustoms/eligibility-audit'},
    signal:AbortSignal.timeout(15000), redirect:'error',
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}
try {
  if (!token) throw new Error('PRINTIFY_API_TOKEN is not configured');
  const shops = await get('/shops.json');
  for (const shop of shops) {
    const record = {id:shop.id, title:shop.title, sales_channel:shop.sales_channel, products:[]};
    evidence.shops.push(record);
    for (let page=1; page<=10; page++) {
      const result = await get(`/shops/${encodeURIComponent(shop.id)}/products.json?limit=50&page=${page}`);
      if (!Array.isArray(result.data)) throw new Error('Malformed product response');
      for (const p of result.data) record.products.push({
        id:p.id, title:p.title, blueprint_id:p.blueprint_id, print_provider_id:p.print_provider_id,
        visible:p.visible, external:p.external, updated_at:p.updated_at,
        eligibility_fields:Object.fromEntries(Object.entries(p).filter(([key,value]) => /choice|global|eligible/i.test(key) && ['boolean','number','string'].includes(typeof value))),
        enabled_variant_ids:(p.variants || []).filter(v=>v.is_enabled).map(v=>v.id),
      });
      if (!result.next_page_url) break;
      if (page===10) evidence.truncated=true;
    }
  }
} catch(error) {
  evidence.error = error.message.startsWith('Provider HTTP') || error.message === 'PRINTIFY_API_TOKEN is not configured'
    ? error.message : 'Provider audit could not complete';
  process.exitCode=1;
}
await writeFile(outputPath, JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
