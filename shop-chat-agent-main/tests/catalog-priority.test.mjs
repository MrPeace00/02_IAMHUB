import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogPriority,addProviderPreference,requestedProviderPreference} from '../app/services/catalog-priority.server.js';
const origin = 'https://lazycustoms.com';
const product = (id, available=true) => ({id:`gid://shopify/Product/${id}`,title:`Product ${id}`,variants:[{availability:{available}}],media:[{type:'image',url:`https://cdn.shopify.com/${id}.jpg`}],price_range:{min:{amount:1000,currency:'USD'}}});
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
  assert.equal(requestedProviderPreference('Show me shirts.','printify'),'printify');
});
