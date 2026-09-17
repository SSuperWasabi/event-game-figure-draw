const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('app/index.html','utf8');
assert.match(html,/<div id="idle-video-blur"/);assert.doesNotMatch(html,/<video id="idle-video-blur"/);
assert.match(html,/<div id="idle-video-poster"/);assert.match(html,/assets\/idle-fallback\.jpg/);
assert.match(html,/idleVideo\.pause\(\)/);assert.match(html,/captureIdleBackdrop/);assert.match(html,/preload="auto"/);
assert.match(html,/K_IDLE_POSTER/);assert.match(html,/addEventListener\('playing'.*hideIdlePoster/);
assert.match(html,/else \{idleVideo\.pause\(\);primeNextIdleVideo\(\);\}/);
assert.match(html,/idleVideoPrefetch/);assert.match(html,/entry\.promise=idbGet\('idlevid_'/);
assert.match(html,/await bootIdle\(\);\s*await Promise\.all\(\[loadAllImages\(\),loadBgm\(\),loadSfx\(\)\]\)/);
const code=html.slice(html.indexOf('let idleVideoBag='),html.indexOf('async function playIdleVideo()'));
const ctx={cfg:{idleVideos:[]},idbGet:async()=>null};vm.createContext(ctx);vm.runInContext('let lastIdleVideoId=null;'+code,ctx);
const vids=Array.from({length:10},(_,i)=>({id:String(i)}));let last;
for(let round=0;round<30;round++){const ids=Array.from({length:10},()=>ctx.nextIdleVideo(vids).id);assert.equal(new Set(ids).size,10);assert.notEqual(ids[0],last);last=ids[9];}
assert.equal(ctx.nextIdleVideo([]),null);assert.equal(ctx.nextIdleVideo([{id:'only'}]).id,'only');assert.equal(ctx.nextIdleVideo([{id:'only'}]).id,'only');
const changed=[{id:'new1'},{id:'new2'}];assert.equal(new Set([ctx.nextIdleVideo(changed).id,ctx.nextIdleVideo(changed).id]).size,2);
console.log('PASS: 30 complete cycles, boundary duplicates, empty/single and changed roster; prioritized boot and one-clip prefetch with one video decoder');
