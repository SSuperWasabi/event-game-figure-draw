const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app/scroll-audio.js','utf8')+'\nglobalThis.sound=ScrollSound;';
function harness(idleAvailable){
  const calls=[];let audio;
  const buffer=data=>({numberOfChannels:1,length:data.length,sampleRate:4,duration:1,getChannelData:()=>data});
  class FakeAudio{
   constructor(){audio=this;this.state='suspended';this.currentTime=0;this.destination={};}
   async resume(){this.state='running';}
   async decodeAudioData(){return buffer(new Float32Array([0,1,2,3]));}
   createBuffer(){return buffer(new Float32Array(4));}
   createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
   createBufferSource(){const source={connect(){},disconnect(){},start(...args){calls.push({samples:[...source.buffer.getChannelData(0)],loop:!!source.loop,args});},stop(){calls.push({stopped:true});}};return source;}
  }
  const context={window:{AudioContext:FakeAudio},fetch:async url=>({ok:idleAvailable||!/idle|summon/.test(url),arrayBuffer:async()=>new ArrayBuffer(1)})};
  vm.createContext(context);vm.runInContext(code,context);
  return {calls,context,audio:()=>audio};
}
const full=harness(true),partial=harness(false);
setImmediate(()=>{
 const {calls,context}=full,audio=full.audio();
 assert.equal(context.sound.has('open'),true);assert.equal(partial.context.sound.has('open'),true);
 context.sound.begin();context.sound.scrub(.3,false);assert.deepEqual(calls[0].samples,[0,1,2,3]);
 audio.currentTime=.05;context.sound.scrub(.1,false);assert.deepEqual(calls[1].samples,[3,2,1,0]);
 const count=calls.length;audio.currentTime=.1;context.sound.scrub(.1,false);assert.equal(calls.length,count);
 context.sound.scrub(.7,true);assert.ok(calls.slice(count).every(c=>c.stopped));
 assert.ok(calls[0].args[2]<=.1);
 console.log('PASS: gesture audio unlock, forward/reverse grains, stationary silence, mute and bounded sound duration');
 // Idle bed: loops from the video's current offset, is silent when muted, and stops when scrubbing begins.
 const start=calls.length;assert.equal(context.sound.loop(2.5,false),true);
 const bed=calls.slice(start).find(c=>c.loop);assert.ok(bed);assert.ok(Math.abs(bed.args[1]-.5)<1e-9); // 2.5 s into a 1 s buffer wraps to 0.5 s
 const muted=calls.length;assert.equal(context.sound.loop(0,true),true);assert.ok(calls.slice(muted).every(c=>c.stopped));
 context.sound.loop(0,false);const beforeBegin=calls.length;context.sound.begin();assert.ok(calls.slice(beforeBegin).some(c=>c.stopped));
 // Without an idle buffer the caller must fall back to the video element's own track.
 assert.equal(partial.context.sound.loop(0,false),false);assert.equal(partial.context.sound.loop(0,true),true);
 // Summon clip: one-shot from the video position (clamped to the buffer), muted → silent, missing → fallback.
 assert.equal(context.sound.has('summon'),true);const s0=calls.length;assert.equal(context.sound.cue('summon',.25,false),true);
 const shot=calls.slice(s0).find(c=>!c.stopped);assert.equal(shot.loop,false);assert.ok(Math.abs(shot.args[1]-.25)<1e-9);
 const s1=calls.length;context.sound.cue('summon',9,false);assert.equal(calls.slice(s1).find(c=>!c.stopped).args[1],1);
 const s2=calls.length;assert.equal(context.sound.cue('summon',0,true),true);assert.ok(calls.slice(s2).every(c=>c.stopped));
 assert.equal(partial.context.sound.has('summon'),false);assert.equal(partial.context.sound.cue('summon',0,false),false);
 console.log('PASS: idle bed offset/loop, summon one-shot cue/clamp, mute, stop on scrub, and fallback signal when the idle buffer is unavailable');
 const op=calls.length;context.sound.cue('open',.4,false);
 const opening=calls.slice(op).find(c=>!c.stopped);assert.equal(opening.loop,false);assert.equal(opening.args[1],.4);
 console.log('PASS: automatic opening reuses decoded forward audio at the video offset');
});
