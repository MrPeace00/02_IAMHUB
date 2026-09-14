import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogPriority,addProviderPreference,requestedProviderPreference,catalogArgsForRequest} from '../app/services/catalog-priority.server.js';
import {dispatchStarter} from '../app/services/starter-intent.server.js';
const origin = 'https://lazycustoms.com';
const product = (id, available=true) => ({id:`gid://shopify/Product/${id}`,title:`Product ${id}`,variants:[{availability:{available}}],media:[{type:'image',url:`https://cdn.shopify.com/${id}.jpg`}],price_range:{min:{amount:1000,currency:'USD'}}});

test('an all-Printify Shopify catalog remains explicitly unverified and cannot satisfy global fulfillment', async () => {
  const service = createCatalogPriority({cacheStore:new Map(), fetchImplementation:async () => ({
    ok:true, json:async () => ({products:[{id:1,vendor:'Printify'}, {id:2,vendor:'Printify'}]}),
  })});
  const products = [1,2].map(id => ({...product(id), url:`https://lazycustoms.com/products/shirt-${id}`}));
  for (const preference of ['any', 'printify']) {
    const result = await service.prepare({structuredContent:{products},content:[{type:'text',text:JSON.stringify({products})}]}, origin, preference);
    const policy = result.structuredContent.recommendation_policy;
    assert.equal(policy.catalog_source, 'shopify_catalog');
    assert.equal(policy.printify_choice_eligibility, 'unverified');
    assert.equal(policy.destination_coverage, 'unverified');
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.ok(result.structuredContent.products.every(p => p.vendor === 'Printify'));
    let shopifyCalls = 0;
    const searchShopify = async () => { shopifyCalls++; return result.structuredContent.products; };
    const shop = await dispatchStarter({intent:'shopify_catalog', searchShopify});
    const global = await dispatchStarter({intent:'global_fulfillment', searchShopify});
    assert.equal(shopifyCalls, 1);
    assert.deepEqual(shop.products.map(p => p.url), products.map(p => p.url));
    assert.equal(global.state, 'unavailable');
    assert.equal(global.reason, 'eligibility_source_not_configured');
    assert.deepEqual(global.products, []);
  }
});
function setup(fail=false) {
  let calls=0;
  const service=createCatalogPriority({cacheStore:new Map(),fetchImplementation:async()=>{
    calls++;
    if(fail) throw Error('offline');
    return {ok:true,json:async()=>({products:[{id:1,vendor:'Other'},{id:2,vendor:'Printify'},{id:3,vendor:'Printify'}]})};
  }});
  return {service,calls:()=>calls};
}
test('same provider order and product identity reaches the model and cards before display limit', async()=>{
  const {service,calls}=setup();
  const body={products:[product(1),product(3,false),product(2)],pagination:{has_next_page:false}};
  const result=await service.prepare({structuredContent:body,content:[{type:'text',text:JSON.stringify(body)}]},origin);
  assert.deepEqual(result.structuredContent.products.map(p=>p.id),[product(2).id,product(1).id,product(3).id]);
  assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
  assert.equal(result.structuredContent.products[0].vendor,'Printify');
  assert.deepEqual(result.structuredContent.products[0].media,product(2).media);
  assert.deepEqual(body.products.map(p=>p.id),[product(1).id,product(3).id,product(2).id]);
  await service.prepare({structuredContent:body},origin);
  assert.equal(calls(),1);
});
test('explicit choices retain order; text envelope and missing provider metadata remain usable', async()=>{
  const {service}=setup();
  const body={products:[product(1),product(2)]};
  const result=await service.prepare({content:[{type:'text',text:JSON.stringify(body)}]},origin,'any');
  assert.deepEqual(result.structuredContent.products.map(p=>p.id),[product(1).id,product(2).id]);
  const failing=setup(true);
  const fallback=await failing.service.prepare({structuredContent:body},origin);
  assert.deepEqual(fallback.structuredContent.products,body.products);
  assert.equal(fallback.structuredContent.recommendation_policy.vendor_metadata_available,false);
  await failing.service.prepare({structuredContent:body},origin);
  assert.equal(failing.calls(),1);
});
test('untrusted origins and tool errors never trigger metadata fetches',async()=>{
  const {service,calls}=setup();
  const failure={isError:true,content:[{type:'text',text:'failed'}]};
  assert.equal(await service.prepare(failure,origin),failure);
  const result=await service.prepare({structuredContent:{products:[product(9)]}},'https://attacker.example');
  assert.equal(result.structuredContent.products[0].vendor,undefined);
  assert.equal(calls(),0);
});
test('local preference extends only search schema without mutating discovered schema',()=>{
  const tools=[{name:'search_catalog',input_schema:{properties:{catalog:{type:'object'}},required:['catalog']}},{name:'create_cart'}];
  const updated=addProviderPreference(tools);
  assert.equal(updated[1],tools[1]);
  assert.deepEqual(updated[0].input_schema.required,['catalog']);
  assert.deepEqual(updated[0].input_schema.properties.provider_preference.enum,['printify','any','exclude_printify']);
  assert.equal(tools[0].input_schema.properties.provider_preference,undefined);
});

test('explicit provider exclusion removes conflicting cards and unverified providers',async()=>{
  const {service}=setup();
  const preference=requestedProviderPreference('Show me shirts from another provider, not Printify.', 'any');
  assert.equal(preference,'exclude_printify');
  const result=await service.prepare({structuredContent:{products:[product(2),product(1),product(9)]}},origin,preference);
  assert.deepEqual(result.structuredContent.products.map(p=>p.id),[product(1).id]);
  assert.equal(result.structuredContent.recommendation_policy.excluded_vendor,'Printify');
  assert.equal(requestedProviderPreference('Show me the Shopify catalog from any provider.','printify'),'any');
  assert.equal(requestedProviderPreference('Show me shirts.','printify'),'printify');
});

test('generic browsing uses the supported empty query without discarding catalog filters',()=>{
  const args={provider_preference:'printify',catalog:{query:'available products',price:{max:4000}}};
  assert.deepEqual(catalogArgsForRequest('What do you have?',args),{
    providerPreference:'printify',catalogArgs:{catalog:{query:'',price:{max:4000}}},
  });
  assert.deepEqual(catalogArgsForRequest('Show me shirts.',args),{
    providerPreference:'printify',catalogArgs:{catalog:{query:'available products',price:{max:4000}}},
  });
  assert.equal(args.catalog.query,'available products');
});
