const {chromium}=require('../.tools/node_modules/playwright-core');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('app');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{
  if(error){res.writeHead(404).end();return;}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.mp4':'video/mp4','.wav':'audio/wav','.jpg':'image/jpeg'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  // Deliberately no Range support: exercise the original local-server fallback too.
  res.end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:1366},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let release;const mediaGate=new Promise(resolve=>{release=resolve;});
  await page.route('**/sacred-open.mp4',async route=>{await mediaGate;await route.continue();});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{stock={ip1:[0,10]};cfg.muted=true;refreshIdleSoldout();});
  await page.locator('#idle-banner').click();await page.locator('.scroll-choice').first().click();await page.locator('#scroll-next').click();
  await page.locator('#scroll-open-btn').click();
  const cold=await page.evaluate(()=>({ready:scrollVideo().readyState,visible:getComputedStyle(document.getElementById('scroll-idle-video')).visibility,log:logArr.length}));
  assert.equal(cold.ready,0,'test must click while real video is still loading');
  assert.equal(cold.visible,'visible','keep idle image/video visible during preparation');assert.equal(cold.log,0);
  release();
  try{await page.waitForFunction(()=>currentScreen==='scr-result',null,{timeout:20000});}
  catch(error){console.log(await page.evaluate(()=>({screen:currentScreen,drawing,pending:scrollAutoPending,events:window.scrollMediaDiagnostics,ready:scrollVideo().readyState,time:scrollVideo().currentTime,error:scrollVideo().error?.message,src:scrollVideo().currentSrc})));throw error;}
  assert.equal(await page.evaluate(()=>logArr.length),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual delayed MP4 playback keeps idle visible and completes automatic reveal once (Chrome, no Range server)');
  await page.unroute('**/sacred-open.mp4');
  await page.evaluate(()=>resetToIdle());
  await page.locator('#idle-banner').click();await page.locator('.scroll-choice').first().click();await page.locator('#scroll-next').click();
  const box=await page.locator('#scroll-drag').boundingBox();
  await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height/2,{steps:8});
  try{await page.waitForFunction(()=>scrollVideo().currentTime>1&&!scrollVideo().seeking,null,{timeout:10000});}
  catch(error){console.log(await page.evaluate(()=>({scrubbing:scrollScrubbing,ready:scrollVideo().readyState,time:scrollVideo().currentTime,seeking:scrollVideo().seeking,target:scrollSeekTarget,progress:document.getElementById('scroll-drag').style.getPropertyValue('--progress'),events:scrollMediaDiagnostics.slice(-12)})));throw error;}
  await page.mouse.move(box.x+20,box.y+box.height/2,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>logArr.length),1);
  console.log('PASS: actual video seeks during drag; reversed/cancelled drag does not draw');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
