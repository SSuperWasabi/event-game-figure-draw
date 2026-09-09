const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const handlers={};let cached=new Response(new Uint8Array([0,1,2,3,4,5]),{headers:{'Content-Type':'video/mp4'}});
const context={self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,caches:{open:async()=>({match:async()=>cached&&cached.clone()})},fetch:async()=>{throw Error('offline');}};
vm.runInNewContext(fs.readFileSync('app/sw.js','utf8'),context);
async function request(range){let response;handlers.fetch({request:new Request('https://example.test/app/assets/figure/idle.mp4',{headers:range?{range}:{}}),respondWith:p=>response=p,waitUntil:()=>{}});return response;}
(async()=>{
 let r=await request('bytes=1-3');assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 1-3/6');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);
 r=await request('bytes=-2');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[4,5]);
 assert.equal((await request('bytes=50-60')).status,416);
 cached=null;assert.equal((await request()).status,503);
 console.log('PASS: offline video byte ranges, invalid ranges and cache-miss network failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
