const fs=require('node:fs'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ffmpeg=process.env.FFMPEG||'.tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
for(const name of ['sacred-idle.mp4','sacred-open.mp4']){
 const file='app/assets/figure/'+name,bytes=fs.readFileSync(file),avc=bytes.indexOf(Buffer.from('avcC'));
 assert.ok(avc>=0,'H.264 AVC configuration must exist');
 assert.equal(bytes[avc+7],31,'MP4 must advertise H.264 level 3.1, not unsupported 6.2');
 const run=spawnSync(ffmpeg,['-hide_banner','-i',file,'-map','0:v:0','-c','copy','-bsf:v','trace_headers','-frames:v','1','-f','null','-'],{encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(run.status,0,run.error?.message||run.stderr);
 assert.match(run.stderr,/level_idc\s+[01]+ = 31/);
 assert.match(run.stderr,/num_units_in_tick\s+[01]+ = 1/);
 assert.match(run.stderr,/time_scale\s+[01]+ = 60/,'SPS timing must describe 30fps, not a 30720 Hz frame clock');
 const decode=spawnSync(ffmpeg,['-v','error','-i',file,'-f','null','-'],{encoding:'utf8'});
 assert.equal(decode.status,0);assert.equal(decode.stderr.trim(),'');
 console.log('PASS:',name,'AVC/SPS level 3.1, 30fps timing and complete audio/video decode');
}
