/* One reusable participation-result clip. No draw/inventory/timer side effects. */
class PreparedResultVideo {
  constructor(video,changed){
    this.video=video;this.changed=changed;this.entry=null;this.visible=false;
    this.suspended=false;this.diagnostics=[];this.view=0;
    video.muted=true;video.loop=true;video.playsInline=true;
    for(const event of ['waiting','error'])video.addEventListener(event,()=>{
      if(this.visible)this.record(event);
    });
  }
  record(event,extra={}){
    this.diagnostics.push({event,key:this.entry?.key??null,at:Math.round(performance.now()),...extra});
    if(this.diagnostics.length>100)this.diagnostics.shift();
  }
  // Reuse tested cancellable media waits, not the main deck's lifecycle.
  wait(entry,events,test){return IdleVideoDeck.prototype.wait.call(this,entry,events,test);}
  frame(entry){return IdleVideoDeck.prototype.frame.call(this,entry);}
  valid(entry){return !!entry&&this.entry===entry&&!entry.controller.signal.aborted;}
  clear(){
    this.hide();const entry=this.entry;this.entry=null;
    if(!entry)return;
    entry.controller.abort();this.video.pause();this.video.removeAttribute('src');this.video.load();
    if(entry.url)URL.revokeObjectURL(entry.url);
    this.record('released',{key:entry.key});
  }
  ensure(key){
    if(this.entry?.key===key)return this.entry;
    this.clear();if(!key)return null;
    const entry={key,video:this.video,controller:new AbortController(),state:'reading',ready:false,url:null};
    this.entry=entry;this.record('read');
    entry.read=idbGet(key).then(data=>{
      if(!this.valid(entry))return;
      const blob=typeof data==='string'?data:mediaBlob(data);
      if(!blob)throw Error('Result video unavailable');
      this.video.src=typeof blob==='string'?blob:(entry.url=URL.createObjectURL(blob));
      this.video.load();entry.state='loaded';this.record('source-attached');
    }).catch(error=>this.fail(entry,error));
    return entry;
  }
  fail(entry,error){
    if(!this.valid(entry))return;
    if(error.name==='AbortError'&&(!this.visible||this.suspended||document.hidden)){
      entry.state='loaded';entry.ready=false;return;
    }
    entry.state='failed';entry.ready=false;this.video.pause();
    this.record('failed',{message:String(error.message||error)});
  }
  prepare(key){
    const entry=this.ensure(key);if(!entry||this.suspended||document.hidden)return Promise.resolve();
    if(entry.task)return entry.task;
    if(entry.ready&&this.video.readyState>=2&&!this.video.seeking)return Promise.resolve();
    entry.task=(async()=>{
      try{
        await entry.read;
        if(!this.valid(entry)||entry.state==='failed'||this.suspended||document.hidden)return;
        entry.state='preparing';
        if(!entry.decoded||this.video.readyState<2){
          const frame=this.frame(entry);await Promise.all([this.video.play(),frame]);
          if(!this.valid(entry))return;
          entry.decoded=true;
        }
        if(this.suspended||document.hidden){this.video.pause();return;}
        if(!this.visible){
          this.video.pause();this.video.currentTime=0;
          await this.wait(entry,['seeked','loadeddata'],()=>!this.video.seeking&&this.video.readyState>=2);
        }
        if(!this.valid(entry))return;
        entry.ready=true;entry.state='ready';this.record('ready');
        if(this.visible&&!this.suspended&&!document.hidden)this.play(entry);
      }catch(error){this.fail(entry,error);}
    })().finally(()=>{entry.task=null;});
    return entry.task;
  }
  play(entry){
    if(!this.valid(entry)||!this.visible||this.suspended||document.hidden)return;
    this.video.classList.add('has-frame');this.changed(true);
    const view=this.view;
    this.frame(entry).then(metadata=>{
      if(this.valid(entry)&&this.visible&&view===this.view)this.record('entry-frame',{ms:Math.round(performance.now()-this.enteredAt),mediaTime:metadata?.mediaTime??this.video.currentTime});
    }).catch(()=>{});
    this.video.play().catch(error=>this.fail(entry,error));
  }
  show(key){
    const entry=this.ensure(key);if(!entry)return;
    this.visible=true;this.view++;this.enteredAt=performance.now();
    const warm=entry.ready&&this.video.readyState>=2&&!this.video.seeking&&this.video.currentTime<.08;
    this.record('enter',{warm,readyState:this.video.readyState});this.changed(true);
    if(warm)this.play(entry);else this.prepare(key);
  }
  hide(){
    if(!this.visible){this.changed(false);return;}
    this.visible=false;this.view++;this.video.pause();this.video.classList.remove('has-frame');this.changed(false);
    if(this.entry&&this.video.currentTime>0)this.entry.ready=false;
  }
  suspend(){this.suspended=true;this.video.pause();}
  resume(){
    this.suspended=false;
    const entry=this.entry;
    if(entry?.task&&entry.state==='preparing'){
      // Continue an interrupted warm-up using this source, without a new read.
      this.video.play().catch(error=>this.fail(entry,error));
    }
    if(this.visible&&this.entry){
      if(this.entry.decoded&&this.video.readyState>=2)this.play(this.entry);
      else this.prepare(this.entry.key);
    }
  }
}
