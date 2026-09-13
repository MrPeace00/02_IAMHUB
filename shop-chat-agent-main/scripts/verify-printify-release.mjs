// Live shopping checks only: no carts, purchases, images, or order submission.
const origin='https://lazycustoms.com';
const cases=[
  ['standardAssistant','Show me shirts.'],
  ['systemShopping','What do you have?'],
  ['standardAssistant','Show me shirts from another provider, not Printify.'],
];
for (const [prompt_type,message] of cases) {
  const response=await fetch('https://ai.lazycustoms.com/chat',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Accept:'text/event-stream','User-Agent':'Agent/LazyCustomsChatAssistant'},
    body:JSON.stringify({prompt_type,message,conversation_id:crypto.randomUUID()}),signal:AbortSignal.timeout(60000),
  });
  const events=(await response.text()).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
  console.log(JSON.stringify({prompt_type,message,httpStatus:response.status,
    answer:events.filter(e=>e.type==='chunk').map(e=>e.chunk).join(''),
    tools:events.filter(e=>e.type==='tool_use').map(e=>e.tool_use_message),
    products:events.filter(e=>e.type==='product_results').flatMap(e=>e.products).map(p=>({id:p.id,title:p.title,vendor:p.vendor,image_url:p.image_url,url:p.url})),
    errors:events.filter(e=>e.type==='error'||e.type==='rate_limit_exceeded'),
  }));
}
