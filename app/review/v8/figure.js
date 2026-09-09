/* Figure Draw participant journey. v31 admin/media/backup remains the base. */
let selectedScroll=null, openingFrame=0, openingTimer=null, resultTick=null, resultDeadline=0;
let figureMediaUrls=[], figurePopup=null, figureEpoch=0;
const figureBase={renderAdmIps,renderAdmSettings,renderResult,resetToIdle,bootIdle,go,startBgm};
const figurePercent=()=>Number(cfg.figureWinPercent??10);
const figureProbabilityEnabled=()=>cfg.figureProbabilityEnabled===true;
const activeFigurePercent=()=>figureProbabilityEnabled()?figurePercent():null;
let scrollScrubbing=false,scrollSeekTarget=null;
// BGM: optional single-track mode keeps one slot looping across screens. It never touches volume, so the
// 25% ducking on the scroll screen (scrollMix) and the admin mute keep working exactly as before.
const BGM_SLOTS=['idle','select','play'];
const bgmSingle=()=>cfg.bgmMode==='single';
const bgmSingleSlot=()=>BGM_SLOTS.includes(cfg.bgmSingleSlot)?cfg.bgmSingleSlot:'idle';
startBgm=function(slot){
  if(bgmSingle()){slot=bgmSingleSlot();const a=bgmEl[slot];if(curBgm===slot&&a&&a.src&&!a.paused&&!cfg.muted)return;}
  figureBase.startBgm(slot);
};
const scrollVideo=()=>document.getElementById('scroll-video');
let scrollBgmVolumes=null,whiteoutFrame=0;
function scrollMix(active){
  if(active&&!scrollBgmVolumes){scrollBgmVolumes=Object.values(bgmEl).map(v=>[v,v.volume]);scrollBgmVolumes.forEach(([v,volume])=>v.volume=volume*.25);}
  if(!active&&scrollBgmVolumes){scrollBgmVolumes.forEach(([v,volume])=>v.volume=volume);scrollBgmVolumes=null;}
}
function scrollWhiteout(value,fade=false){const el=document.getElementById('scroll-whiteout');el.style.transition=fade?'opacity 400ms ease-out':'none';el.style.opacity=String(Math.max(0,Math.min(1,value)));}
function updateScrollWhiteout(time){const duration=scrollVideo().duration;if(Number.isFinite(duration))scrollWhiteout((time-(duration-.3))/.3);}
let scrollSeekReady=false,figureObjectUrls=[],scrollPlaybackFailed=false;
// Figure win: the full-screen summon clip plays (with sound) before the result screen. Participation prizes skip it.
let summonTimer=null,summonEpoch=-1,summonUnlocked=false,summonTrack=false;
const summonStage=()=>document.getElementById('summon-stage'),summonVideos=()=>[document.getElementById('summon-video'),document.getElementById('summon-video-blur')];
const summonActive=()=>summonStage().classList.contains('active');
// iOS only lets script start audible playback on elements that were loaded inside a user gesture; do it once when the open screen is entered.
function summonUnlock(){if(summonUnlocked)return;summonUnlocked=true;summonVideos().forEach(v=>{try{v.load();}catch{}});}
function hideSummon(){clearTimeout(summonTimer);ScrollSound.stop();summonStage().classList.remove('active','fading');summonVideos().forEach(v=>{v.pause();try{v.currentTime=0;}catch{}});}
function endSummon(epoch){
  if(epoch!==figureEpoch||epoch!==summonEpoch||currentScreen!=='scr-open'||!summonActive())return;
  clearTimeout(summonTimer);summonEpoch=-1;showResult();startResultMedia();
  summonStage().classList.add('fading');summonTimer=setTimeout(()=>{if(summonStage().classList.contains('fading'))hideSummon();},450);
}
function playSummon(epoch){
  const [v,b]=summonVideos();summonEpoch=epoch;clearTimeout(summonTimer);
  summonStage().classList.remove('fading');summonStage().classList.add('active');
  // Web Audio carries the sound (the same path as the scroll sounds); the video's own track is used only as a fallback.
  summonTrack=!ScrollSound.has('summon');
  v.muted=summonTrack?!!cfg.muted:true;v.volume=1;b.muted=true;v.loop=b.loop=false;try{v.currentTime=0;b.currentTime=0;}catch{}
  v.play().catch(()=>endSummon(epoch));b.play().catch(()=>{});
  // Watchdog: a stalled clip must never trap the kiosk on this screen.
  summonTimer=setTimeout(()=>endSummon(epoch),(Number.isFinite(v.duration)&&v.duration>0?v.duration:8)*1000+3000);
}
document.getElementById('summon-video').addEventListener('ended',()=>endSummon(summonEpoch));
// Start the clip audio exactly where the picture (re)starts, and hold it while the picture stalls.
document.getElementById('summon-video').addEventListener('playing',()=>{const v=summonVideos()[0];if(summonActive()&&!summonTrack)ScrollSound.cue('summon',v.currentTime,!!cfg.muted);});
document.getElementById('summon-video').addEventListener('waiting',()=>{if(summonActive()&&!summonTrack)ScrollSound.stop();});
document.getElementById('summon-video').addEventListener('error',()=>endSummon(summonEpoch));
document.getElementById('summon-video').addEventListener('timeupdate',()=>{const [v,b]=summonVideos();if(summonActive()&&b.readyState>=2&&Math.abs(v.currentTime-b.currentTime)>.25){try{b.currentTime=v.currentTime;}catch{}}});
// A complete Blob is seekable even when the local HTTP server has no Range support, and one download can feed several elements.
async function prepareBlobVideo(ids){
  const source=document.getElementById(ids[0]).getAttribute('src');
  const response=await fetch(source);if(!response.ok)throw Error('영상 다운로드 실패');
  const url=URL.createObjectURL(await response.blob());figureObjectUrls.push(url);
  ids.forEach(id=>{const v=document.getElementById(id);v.src=url;v.load();});
}
async function prepareScrollVideo(){try{await prepareBlobVideo(['scroll-video']);scrollSeekReady=true;}catch{toast('소환 영상을 불러오지 못했습니다. 화면을 새로고침해주세요');}}
if(typeof fetch==='function'){prepareScrollVideo();prepareBlobVideo(['summon-video','summon-video-blur']).catch(()=>{ /* Progressive playback from the original URL remains. */ });}
window.addEventListener('pagehide',e=>{if(!e.persisted){figureObjectUrls.forEach(url=>URL.revokeObjectURL(url));figureObjectUrls=[];}});
function startScrollLoop(){
  ScrollSound.stop();scrollMix(currentScreen==='scr-open');scrollWhiteout(0);
  scrollScrubbing=false;scrollSeekTarget=null;scrollVideo().pause();
  document.getElementById('scroll-drag').classList.remove('scrubbing');
  // The idle loop keeps the clip's own sound (frames 0-100 of the source), following the admin mute switch.
  // Web Audio carries it (the same path as the drag sound); the video track is unmuted only as a fallback.
  const v=document.getElementById('scroll-idle-video');v.loop=true;v.volume=1;
  const bed=currentScreen==='scr-open'&&ScrollSound.loop(v.currentTime,!!cfg.muted);
  v.muted=bed||!!cfg.muted;
  if(currentScreen==='scr-open')v.play().catch(()=>{});
}
function beginScrollScrub(){
  const v=scrollVideo();
  if(!scrollSeekReady||!Number.isFinite(v.duration)||v.duration<=0||v.readyState<2){toast('소환 영상을 불러오는 중입니다. 잠시 후 다시 시도해주세요');return false;}
  document.getElementById('scroll-idle-video').pause();v.pause();v.muted=true;v.loop=false;scrollScrubbing=true;ScrollSound.begin();scrollMix(true);
  document.getElementById('scroll-drag').classList.add('scrubbing');setScrollProgress(0);return true;
}
function flushScrollSeek(){
  const v=scrollVideo();if(!scrollScrubbing||v.seeking||scrollSeekTarget===null||!Number.isFinite(v.duration)||v.duration<=0)return;
  const target=scrollSeekTarget;scrollSeekTarget=null;
  try{v.currentTime=target;}catch{scrollSeekTarget=target;}
}
scrollVideo().addEventListener('seeked',flushScrollSeek);
scrollVideo().addEventListener('loadedmetadata',()=>{if(scrollScrubbing)setScrollProgress(Number(document.getElementById('scroll-drag').style.getPropertyValue('--progress'))||0);});
// Shared ending for both paths: fully white, result screen underneath, then the white lifts.
function finishScrollReveal(){
  ScrollSound.stop();scrollScrubbing=false;scrollSeekTarget=null;scrollVideo().pause();scrollWhiteout(1);clearTimeout(openingTimer);
  const epoch=figureEpoch;
  if(lastResult&&lastResult.high)playSummon(epoch);else{showResult();startResultMedia();}
  whiteoutFrame=requestAnimationFrame(()=>{whiteoutFrame=requestAnimationFrame(()=>{if(epoch===figureEpoch&&(currentScreen==='scr-result'||summonActive()))scrollWhiteout(0,true);});});
}
scrollVideo().addEventListener('ended',()=>{if(drawing&&currentScreen==='scr-open')finishScrollReveal();});
scrollVideo().addEventListener('timeupdate',()=>{if(drawing&&currentScreen==='scr-open')updateScrollWhiteout(scrollVideo().currentTime);});
function scrollPlaybackError(){
  if(!drawing||currentScreen!=='scr-open')return;
  ScrollSound.stop();scrollPlaybackFailed=true;const btn=document.getElementById('scroll-open-btn');btn.disabled=false;btn.textContent='소환 영상 다시 재생';
  toast('영상 재생이 중단되었습니다. 다시 재생해주세요');
}
scrollVideo().addEventListener('error',scrollPlaybackError);
function playOpeningVideo(){
  const v=scrollVideo();scrollSeekTarget=null;scrollScrubbing=false;scrollPlaybackFailed=false;
  ScrollSound.stop();scrollMix(true);v.muted=!!cfg.muted;v.volume=1;
  document.getElementById('scroll-open-btn').disabled=true;
  v.loop=false;v.play().catch(scrollPlaybackError);
}
go = function(id){
  figureBase.go(id);
  if(id==='scr-open')startScrollLoop();else{ScrollSound.stop();scrollMix(false);scrollScrubbing=false;scrollSeekTarget=null;scrollVideo().pause();document.getElementById('scroll-idle-video').pause();if(id!=='scr-result'){cancelAnimationFrame(whiteoutFrame);scrollWhiteout(0);}}
  for(const key of ['idle-video','idle-video-blur']){const v=document.getElementById(key);if(id==='scr-idle'&&v.getAttribute('src'))v.play().catch(()=>{});else v.pause();}
};
document.getElementById('idle-video').addEventListener('timeupdate',()=>{
  const foreground=document.getElementById('idle-video'),background=document.getElementById('idle-video-blur');
  if(currentScreen==='scr-idle'&&background.readyState>=2&&Math.abs(foreground.currentTime-background.currentTime)>.25){try{background.currentTime=foreground.currentTime;}catch{}}
});

function figureAvailable(){return FigureDrawEngine.availability(cfg.ips,stock,activeFigurePercent());}
refreshIdleSoldout = function(){
  const state=figureAvailable();
  document.getElementById('scr-idle').classList.toggle('soldout',!state.ok);
  document.getElementById('idle-banner').textContent=state.ok?'TOUCH': '이벤트 준비 중 · 스태프에게 문의해주세요';
}
bootIdle = async function(){await figureBase.bootIdle();document.getElementById('idle-sub').textContent='';} // The idle screen shows the logo lockup only.
function startFigureGame(){
  const state=figureAvailable();if(!state.ok){toast(state.reason);return;}
  startBgm('select');selectedScroll=null;renderScrollSelection();go('scr-scrolls');
}
document.getElementById('scr-idle').addEventListener('click',e=>{
  if(e.target.closest('#admin-tap'))return;
  e.stopImmediatePropagation();startFigureGame();
},true);
function renderScrollSelection(){
  document.getElementById('scroll-grid').innerHTML=Array.from({length:12},(_,i)=>`<button class="scroll-choice" aria-label="${i+1}번 소환서 선택" aria-pressed="${selectedScroll===i}" onclick="chooseScroll(${i})"><img src="assets/figure/scroll.webp" alt=""><span>${String(i+1).padStart(2,'0')}</span></button>`).join('');
  document.getElementById('scroll-status').textContent=selectedScroll==null?'소환서를 선택해주세요':`${selectedScroll+1}번 소환서 선택`;
  document.getElementById('scroll-next').disabled=selectedScroll==null;
}
function chooseScroll(i){selectedScroll=selectedScroll===i?null:i;playSfx('pick');renderScrollSelection();manageIdle();}
function randomScroll(){selectedScroll=Math.floor(Math.random()*12);playSfx('pick');renderScrollSelection();manageIdle();}
function openSelectedScroll(){
  if(selectedScroll==null)return;
  drawing=false;setScrollProgress(0);document.getElementById('scr-open').classList.remove('opening');
  document.getElementById('scroll-open-btn').disabled=false;
  document.getElementById('scroll-open-btn').textContent='소환서 자동 오픈';scrollPlaybackFailed=false;
  document.getElementById('open-back').disabled=false;
  document.getElementById('open-number').textContent=`${selectedScroll+1}번 소환서`;
  summonUnlock();startBgm('play');go('scr-open');
}
function setScrollProgress(value){
  document.getElementById('scroll-drag').style.setProperty('--progress',value);
  const v=scrollVideo();
  if(scrollScrubbing&&Number.isFinite(v.duration)&&v.duration>0){scrollSeekTarget=Math.max(0,Math.min(1,value))*Math.max(0,v.duration-1/30);ScrollSound.scrub(scrollSeekTarget,!!cfg.muted);updateScrollWhiteout(scrollSeekTarget);flushScrollSeek();}
}
manageIdle = function(){
  clearTimeout(idleTimer);
  if(drawing&&currentScreen==='scr-open')return;
  if(currentScreen==='scr-result'){
    if(figurePopup)return;
    resultDeadline=Date.now()+5000;idleTimer=setTimeout(resetToIdle,5000);updateResultCountdown();
  }else if(['scr-scrolls','scr-open','scr-ip','scr-lineup'].includes(currentScreen)){
    idleTimer=setTimeout(resetToIdle,Math.max(3,cfg.idleTimeoutSec||30)*1000);
  }
}
resetIdle = function(){if(currentScreen!=='scr-idle'&&currentScreen!=='scr-admin')manageIdle();}
document.getElementById('kiosk').addEventListener('pointermove',()=>{if(!drawing||currentScreen==='scr-result')resetIdle();},{passive:true});
document.getElementById('kiosk').addEventListener('keydown',resetIdle);

function commitFigureDraw(){
  const hit=FigureDrawEngine.draw(cfg.ips,stock,activeFigurePercent());
  const actual=hit.sub==null?hit.p:hit.p.subs[hit.sub],serial=nextSerial();
  const nextLog=[...logArr,{timestamp:new Date().toISOString(),ipId:hit.ip.id,ipName:hit.ip.name,grade:hit.p.grade,prizeName:hit.sub==null?actual.name:hit.p.name+' - '+actual.name,isLastOne:false,luckyGrade:'',serial,kind:hit.kind,drawMode:figureProbabilityEnabled()?'fixed-probability':'stock',figureWinPercent:activeFigurePercent(),scrollNumber:selectedScroll+1}];
  // One localStorage write commits both inventory and log, before any reveal.
  localStorage.setItem(K_STATE,JSON.stringify({stock:hit.stock,log:nextLog}));
  stock=hit.stock;logArr=nextLog;
  curIp=hit.ip;
  lastResult={ip:hit.ip,prize:hit.p,isLucky:false,serial,high:hit.kind==='figure',kind:hit.kind,wonName:actual.name,wonImageKey:actual.imageKey,media:actual.videoKey?actual:hit.p};
}
function commitScrollDraw(){
  try{commitFigureDraw();}catch(error){setScrollProgress(0);startScrollLoop();toast('추첨을 진행하지 못했습니다: '+error.message);return false;}
  drawing=true;clearTimeout(idleTimer);document.getElementById('scroll-open-btn').disabled=true;document.getElementById('open-back').disabled=true;
  document.getElementById('scr-open').classList.add('opening');return true;
}
// Automatic open (button / keyboard): play the whole clip and finish on `ended`.
function revealScroll(){
  if(currentScreen!=='scr-open')return;
  if(drawing){if(scrollPlaybackFailed)playOpeningVideo();return;}
  if(!scrollScrubbing&&!beginScrollScrub())return;
  if(commitScrollDraw())playOpeningVideo();
}
// Completed drag: the paper is already open on screen, so finish directly. Never call play() from the last
// frame: browsers that clamp that seek to `duration` would restart the open clip from its first frame.
function completeScrollDrag(){
  if(currentScreen!=='scr-open'||drawing||!scrollScrubbing)return;
  if(commitScrollDraw())finishScrollReveal();
}
// Progressive left-to-right drag; incomplete and cancelled gestures never draw.
(()=>{
  const el=document.getElementById('scroll-drag');let pointer=null,startX=0;
  el.addEventListener('pointerdown',e=>{if(drawing||pointer!==null||e.button>0)return;if(!beginScrollScrub())return;pointer=e.pointerId;startX=e.clientX;el.setPointerCapture(pointer);});
  el.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||drawing)return;setScrollProgress(Math.max(0,Math.min(1,(e.clientX-startX)/Math.max(1,el.clientWidth*.65))));manageIdle();});
  el.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;const p=Number(el.style.getPropertyValue('--progress'));pointer=null;if(p>=.98)completeScrollDrag();else{setScrollProgress(0);startScrollLoop();}});
  const cancel=()=>{pointer=null;if(!drawing){setScrollProgress(0);startScrollLoop();}};el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();revealScroll();}});
})();
renderResult = function(){
  figureBase.renderResult();
  document.querySelector('#scr-result h2').textContent=lastResult.high?'제라투 소환 성공!':'참여해주셔서 감사합니다!';
  document.getElementById('rc-grade').textContent=lastResult.high?'피규어 당첨':'참가상';
  if(!lastResult.wonImageKey&&lastResult.high){document.getElementById('rc-img').innerHTML='<img src="assets/figure/zeratu.webp" alt="제라투 피규어">';}
  clearInterval(resultTick);resultTick=setInterval(updateResultCountdown,200);
}
function updateResultCountdown(){const e=document.getElementById('result-countdown');if(e)e.textContent=figurePopup?'영상 재생 중':`${Math.max(0,Math.ceil((resultDeadline-Date.now())/1000))}초 후 처음으로 돌아갑니다`;}
async function figureMediaUrl(key){
  if(!key)return null;const data=await idbGet(key);if(!data)return null;if(typeof data==='string')return data;
  const blob=mediaBlob(data);if(!blob)return null;const url=URL.createObjectURL(blob);figureMediaUrls.push(url);return url;
}
async function startResultMedia(){
  const epoch=figureEpoch,result=lastResult,p=result.media||result.prize;
  const url=await figureMediaUrl(p.videoKey);if(epoch!==figureEpoch||currentScreen!=='scr-result')return;
  const el=document.getElementById('rc-img');
  if(url){el.innerHTML='';const v=document.createElement('video');v.src=url;v.muted=true;v.loop=true;v.playsInline=true;v.autoplay=true;el.appendChild(v);v.play().catch(()=>{});}
  el.onclick=p.popupVideoKey?()=>showFigurePopup(p.popupVideoKey):null;
  el.style.cursor=p.popupVideoKey?'pointer':'';el.tabIndex=p.popupVideoKey?0:-1;
  el.setAttribute('aria-label',p.popupVideoKey?'경품 영상 보기':result.wonName);
  el.onkeydown=p.popupVideoKey?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showFigurePopup(p.popupVideoKey);}}:null;
  document.getElementById('result-hint').textContent=p.popupVideoKey?'상품을 터치하면 영상을 볼 수 있습니다':'스태프에게 이 화면을 보여주세요';
}
async function showFigurePopup(key){
  if(figurePopup)return;
  const epoch=figureEpoch;const url=await figureMediaUrl(key);if(!url||epoch!==figureEpoch||currentScreen!=='scr-result')return;
  figurePopup=document.createElement('div');figurePopup.className='figure-media-popup';figurePopup.setAttribute('role','dialog');figurePopup.setAttribute('aria-label','경품 영상');figurePopup.setAttribute('aria-modal','true');
  const close=document.createElement('button');close.textContent='닫기';close.onclick=closeFigurePopup;
  const video=document.createElement('video');video.src=url;video.controls=true;video.playsInline=true;video.muted=cfg.muted;video.onended=closeFigurePopup;
  figurePopup.append(close,video);document.body.appendChild(figurePopup);clearTimeout(idleTimer);close.focus();
  figurePopup.onkeydown=e=>{if(e.key==='Escape')closeFigurePopup();};video.play().catch(()=>{});
}
function closeFigurePopup(){if(figurePopup){figurePopup.querySelector('video').pause();figurePopup.remove();figurePopup=null;}if(currentScreen==='scr-result'){manageIdle();document.getElementById('rc-img').focus();}}
resetToIdle = function(){
  if(drawing&&currentScreen==='scr-open')return;
  figureEpoch++;clearTimeout(openingTimer);cancelAnimationFrame(openingFrame);clearInterval(resultTick);closeFigurePopup();hideSummon();
  document.querySelectorAll('#scr-result video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});
  figureMediaUrls.forEach(url=>URL.revokeObjectURL(url));figureMediaUrls=[];
  selectedScroll=null;figureBase.resetToIdle();
}
renderAdmIps = function(){
  figureBase.renderAdmIps();
  document.querySelectorAll('#pane-ips .adm-card').forEach((card,ii)=>{
    card.querySelectorAll('.prize-edit-row').forEach((row,pi)=>{
      const p=cfg.ips[ii].prizes[pi],kind=p.kind||(p.tier==='high'?'figure':'participation');
      const select=row.querySelector('select');select.innerHTML=`<option value="participation" ${kind==='participation'?'selected':''}>참가상</option><option value="figure" ${kind==='figure'?'selected':''}>피규어</option>`;
      select.onchange=()=>{p.kind=select.value;p.tier=p.kind==='figure'?'high':'normal';};
      row.querySelector('.cool-in').disabled=true;row.querySelector('.cool-in').title='피규어 드로우에서는 쿨다운을 사용하지 않습니다';
      const media=document.createElement('div');media.className='figure-admin-media';
      media.innerHTML=`<button class="adm-btn sec" onclick="uploadFigureVideo(${ii},${pi},'videoKey')">${p.videoKey?'✓ ':''}상품 영상</button><button class="adm-btn sec" onclick="removeFigureVideo(${ii},${pi},'videoKey')">상품 영상 해제</button><button class="adm-btn sec" onclick="uploadFigureVideo(${ii},${pi},'popupVideoKey')">${p.popupVideoKey?'✓ ':''}클릭 팝업 영상</button><button class="adm-btn sec" onclick="removeFigureVideo(${ii},${pi},'popupVideoKey')">팝업 해제</button>`;row.after(media);
    });
  });
  const note=document.createElement('p');note.className='figure-rule-note';note.textContent='피규어 / 참가상을 지정하고 실제 수량을 입력하세요. 기본은 전체 IP의 노출 경품을 합친 잔여 재고 비례 추첨입니다. 설정 탭에서 별도 피규어 확률을 켤 수 있습니다. 두 모드 모두 쿨다운·행운상은 적용하지 않습니다.';document.getElementById('pane-ips').prepend(note);
}
async function uploadFigureVideo(ii,pi,field){
  const p=cfg.ips[ii].prizes[pi],f=await pickFile('video/*');if(!f)return;
  if(f.size>60*1048576){toast('영상은 60MB 이하로 등록해주세요');return;}
  const buf=await fileToArrayBuffer(f);if(!buf){toast('영상 파일을 읽지 못했습니다');return;}
  const key='figure_video_'+Date.now()+'_'+field;
  if(!await idbPut(key,{buf,type:f.type||'video/mp4'})){toast('영상 저장 공간을 확인해주세요');return;}
  const old=p[field];p[field]=key;if(!saveCfg()){p[field]=old;await idbDel(key);toast('설정 저장 실패');return;}
  toast('영상 등록됨');renderAdmIps();
}
function removeFigureVideo(ii,pi,field){const p=cfg.ips[ii].prizes[pi],old=p[field];delete p[field];if(!saveCfg()){p[field]=old;toast('설정 저장 실패');return;}renderAdmIps();}
renderAdmSettings = function(){
  figureBase.renderAdmSettings();
  const root=document.getElementById('pane-settings'),card=document.createElement('div');card.className='adm-card';
  card.innerHTML=`<h4>피규어 드로우</h4><div class="adm-row"><label for="figure-probability-enabled">피규어 당첨 확률 사용</label><input id="figure-probability-enabled" type="checkbox" role="switch" ${figureProbabilityEnabled()?'checked':''} onchange="updateFigureRuleInputs()" style="flex:none;width:24px;height:24px"></div><div class="adm-row"><label for="figure-percent">피규어 확률 (%)</label><input id="figure-percent" type="number" min="0" max="100" step="any" value="${figurePercent()}" ${figureProbabilityEnabled()?'':'disabled'}></div><p id="figure-mode-note" class="figure-rule-note" aria-live="polite"></p><p class="figure-rule-note">소환서 번호는 확률에 영향을 주지 않습니다. 결과는 무입력 5초 후 복귀합니다. 변경 후 저장 버튼을 눌러 적용하세요.</p><button class="adm-btn pri" onclick="saveFigureRules()">추첨 방식 저장</button>`;root.prepend(card);updateFigureRuleInputs();
  ['set-cool','set-drawidle'].forEach(id=>{const el=document.getElementById(id);el.disabled=true;el.title='피규어 드로우에서는 사용하지 않는 기존 쿠지 설정';});
  root.querySelector('button[onclick="toggleLineup()"]').disabled=true;
  // BGM playback mode lives inside the existing BGM card.
  const bgmHead=[...root.querySelectorAll('.adm-card h4')].find(h=>h.textContent.startsWith('배경음악'));
  if(bgmHead){const box=document.createElement('div');box.className='figure-bgm-mode';
    box.innerHTML=`<div class="adm-row"><label for="bgm-mode">재생 방식</label><select id="bgm-mode" onchange="saveBgmMode()"><option value="screen" ${bgmSingle()?'':'selected'}>화면별 전환</option><option value="single" ${bgmSingle()?'selected':''}>한 곡 연속 루핑</option></select></div><div class="adm-row"><label for="bgm-single-slot">연속 재생 곡</label><select id="bgm-single-slot" onchange="saveBgmMode()" ${bgmSingle()?'':'disabled'}>${BGM_SLOTS.map(s=>`<option value="${s}" ${bgmSingleSlot()===s?'selected':''}>${{idle:'대기',select:'선택',play:'뽑기'}[s]} 슬롯</option>`).join('')}</select></div><p class="figure-rule-note">한 곡 연속 루핑이면 화면이 바뀌어도 선택한 슬롯의 곡이 끊기지 않고 이어집니다. 소환서 화면과 개봉 연출 중 BGM 볼륨 자동 감소(25%)와 음소거는 그대로 적용됩니다. 선택한 슬롯에 업로드된 곡이 없으면 무음입니다.</p>`;
    bgmHead.parentElement.appendChild(box);}
  const note=document.createElement('p');note.className='figure-rule-note';note.textContent='소환서 선택 → 드래그 개봉 → 결과 흐름을 사용합니다. 기존 라인업·NPC·쿨다운 설정은 보존되지만 이 흐름에는 적용하지 않습니다. 대기 영상과 BGM·효과음은 그대로 사용할 수 있습니다.';card.appendChild(note);
}
function saveBgmMode(){
  const mode=document.getElementById('bgm-mode').value,slot=document.getElementById('bgm-single-slot').value;
  const old={mode:cfg.bgmMode,slot:cfg.bgmSingleSlot};
  cfg.bgmMode=mode==='single'?'single':'screen';if(BGM_SLOTS.includes(slot))cfg.bgmSingleSlot=slot;
  if(!saveCfg()){cfg.bgmMode=old.mode;cfg.bgmSingleSlot=old.slot;toast('설정 저장 실패');renderAdmSettings();return;}
  document.getElementById('bgm-single-slot').disabled=!bgmSingle();
  if(curBgm)figureBase.startBgm(bgmSingle()?bgmSingleSlot():curBgm); // apply immediately (admin is reached from the idle screen)
  toast(bgmSingle()?'한 곡 연속 루핑으로 저장됨':'화면별 전환으로 저장됨');
}
function updateFigureRuleInputs(){
  const enabled=document.getElementById('figure-probability-enabled').checked;
  document.getElementById('figure-percent').disabled=!enabled;
  document.getElementById('figure-mode-note').textContent=enabled?'ON · 설정 확률로 피규어 당첨 여부를 결정한 뒤, 같은 종류 안에서 잔여 수량에 비례해 선택합니다. 피규어 소진 시 참가상만 지급하며, 참가상 소진 시 중지합니다(피규어 확률 100% 제외).':'OFF · 재고 비례 추첨: 남은 피규어와 참가상을 합쳐 수량에 비례해 선택합니다. 한 종류가 소진돼도 나머지 경품으로 계속 진행하며, 모든 노출 경품이 소진되면 종료합니다.';
}
function saveFigureRules(){
  const enabled=document.getElementById('figure-probability-enabled').checked;
  const raw=document.getElementById('figure-percent').value,value=Number(raw);
  if(enabled&&(raw.trim()===''||!Number.isFinite(value)||value<0||value>100)){toast('0~100 사이의 확률을 입력해주세요');return;}
  const old={enabled:cfg.figureProbabilityEnabled,percent:cfg.figureWinPercent};
  cfg.figureProbabilityEnabled=enabled;if(enabled)cfg.figureWinPercent=value;
  if(!saveCfg()){cfg.figureProbabilityEnabled=old.enabled;cfg.figureWinPercent=old.percent;toast('설정 저장 실패');return;}
  refreshIdleSoldout();toast(enabled?'설정 확률 추첨으로 저장됨':'재고 비례 추첨으로 저장됨');
}
bootIdle();
