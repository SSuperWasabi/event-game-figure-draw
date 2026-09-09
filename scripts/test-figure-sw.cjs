const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const handlers={};let cached=new Response(new Uint8Array([0,1,2,3,4,5]),{headers:{'Content-Type':'video/mp4'}});
let precache=[];
const context={self:{location:{origin:'https://example.test'},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,Request:class extends Request{constructor(url,options){super(new URL(url,'https://example.test/app/'),options);}},caches:{open:async()=>({match:async()=>cached&&cached.clone(),addAll:async requests=>{precache=requests;}})},fetch:async()=>{throw Error('offline');}};
vm.runInNewContext(fs.readFileSync('app/sw.js','utf8'),context);
async function request(range){let response;handlers.fetch({request:new Request('https://example.test/app/assets/figure/idle.mp4',{headers:range?{range}:{}}),respondWith:p=>response=p,waitUntil:()=>{}});return response;}
(async()=>{
 let installation;handlers.install({waitUntil:task=>{installation=task;}});await installation;
 assert.ok(precache.length>0);assert.ok(precache.every(r=>r.cache==='reload'));
 console.log('PASS: new precache bypasses stale HTTP cache for repaired videos');
 let r=await request('bytes=1-3');assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 1-3/6');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);
 r=await request('bytes=-2');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[4,5]);
 assert.equal((await request('bytes=50-60')).status,416);
 cached=null;assert.equal((await request()).status,503);
 console.log('PASS: offline video byte ranges, invalid ranges and cache-miss network failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
