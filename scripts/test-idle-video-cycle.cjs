const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('app/index.html','utf8');
assert.match(html,/<div id="idle-video-blur"/);assert.doesNotMatch(html,/<video id="idle-video-blur"/);
assert.doesNotMatch(html,/idle-video-poster|K_IDLE_POSTER/);
assert.match(html,/idleDeck\.leave\(\)/);assert.match(html,/captureIdleBackdrop/);assert.match(html,/preload="auto"/);
assert.equal((html.match(/class="idle-media-slot"/g)||[]).length,2);
assert.doesNotMatch(fs.readFileSync('app/figure.js','utf8'),/^bootIdle\(\);/m);
assert.match(html,/await bootIdle\(\);\s*await Promise\.all\(\[loadAllImages\(\),loadBgm\(\),loadSfx\(\)\]\)/);
const code=html.slice(html.indexOf('let idleVideoBag='),html.indexOf('/* Prepare the next actual video element'));
const ctx={cfg:{idleVideos:[]},idbGet:async()=>null};vm.createContext(ctx);vm.runInContext('let lastIdleVideoId=null;'+code,ctx);
const vids=Array.from({length:10},(_,i)=>({id:String(i)}));let last;
for(let round=0;round<30;round++){const ids=Array.from({length:10},()=>ctx.nextIdleVideo(vids).id);assert.equal(new Set(ids).size,10);assert.notEqual(ids[0],last);last=ids[9];}
assert.equal(ctx.nextIdleVideo([]),null);assert.equal(ctx.nextIdleVideo([{id:'only'}]).id,'only');assert.equal(ctx.nextIdleVideo([{id:'only'}]).id,'only');
const changed=[{id:'new1'},{id:'new2'}];assert.equal(new Set([ctx.nextIdleVideo(changed).id,ctx.nextIdleVideo(changed).id]).size,2);
console.log('PASS: 30 complete cycles, boundary duplicates, empty/single and changed roster; single startup and two prepared-video slots without posters');
