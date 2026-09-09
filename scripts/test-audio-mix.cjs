const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const handlers={},starts=[],ctxs=[];
class Audio{constructor(){this.src='';this.currentTime=12;this.paused=true;}get volume(){return 1;}set volume(value){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
class Context{
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.sources=0;ctxs.push(this);}
 resume(){this.state='running';return Promise.resolve();}
 createMediaElementSource(){this.sources++;return {connect(){}};}
 createGain(){return {gain:{value:1,cancelScheduledValues(){},setValueAtTime(v){this.value=v;}},connect(){}};}
 createBufferSource(){return {connect(){},start(){starts.push('buffer');}};}
}
const sandbox={window:{AudioContext:Context},document:{addEventListener:(e,fn)=>handlers[e]=fn},Audio,console,cfg:{muted:false},URL};
vm.createContext(sandbox);
const html=fs.readFileSync('app/index.html','utf8'),start=html.indexOf('let actx=null;'),end=html.indexOf('let tapCount=0',start);
vm.runInContext(html.slice(start,end),sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
 run("bgmEl.idle.src='blob:test';startBgm('idle');setBgmDucked(true)");
 assert.equal(run('bgmEl.idle.volume'),1,'emulated iPad ignores media volume');
 assert.equal(run('bgmGains.get(bgmEl.idle).gain.value'),.1);
 run("startBgm('idle');setBgmDucked(true)");assert.equal(run('bgmGains.get(bgmEl.idle).gain.value'),.1);
 assert.equal(run('bgmEl.idle.currentTime'),12);assert.equal(ctxs[0].sources,3,'one routing node per slot');
 run('cfg.muted=true;applyMute();cfg.muted=false;applyMute()');assert.equal(run('bgmGains.get(bgmEl.idle).gain.value'),.1);
 run('setBgmDucked(false)');assert.equal(run('bgmGains.get(bgmEl.idle).gain.value'),.4);
 run("sfxBuf.special={};actx.state='interrupted';playSfx('fanfare')");await Promise.resolve();assert.deepEqual(starts,['buffer']);
 run("actx.state='interrupted'");handlers.touchend();assert.equal(ctxs[0].state,'running');
 run("cfg.muted=true;playSfx('fanfare')");assert.equal(starts.length,1);
 console.log('PASS: iPad read-only media volume uses .4/.1 gain; restart/mute preserves duck state; interrupted effect context resumes before playback');
})().catch(e=>{console.error(e);process.exitCode=1;});
