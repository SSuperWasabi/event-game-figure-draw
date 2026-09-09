from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'.tools'))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
source=root/'Sacred Scroll Reveal.mp4'
out=root/'app/assets/figure'
cut=101/30
for name,start,end,gop in [('sacred-idle.mp4',0,cut,'30'),('sacred-open.mp4',cut,None,'1')]:
    trim=f'trim=start={start}'+(f':end={end}' if end else '')
    audio=f'atrim=start={start}'+(f':end={end}' if end else '')
    subprocess.run([ffmpeg,'-y','-i',str(source),'-vf',trim+',setpts=PTS-STARTPTS','-af',audio+',asetpts=PTS-STARTPTS','-c:v','libx264','-crf','24','-g',gop,'-c:a','aac','-b:a','160k','-pix_fmt','yuv420p','-movflags','+faststart',str(out/name)],check=True,capture_output=True)
subprocess.run([ffmpeg,'-y','-i',str(source),'-af',f'atrim=start={cut},asetpts=PTS-STARTPTS','-vn','-ar','44100','-ac','2','-c:a','pcm_s16le',str(out/'sacred-open.wav')],check=True,capture_output=True)
subprocess.run([ffmpeg,'-y','-i',str(source),'-af',f'atrim=start=0:end={cut},asetpts=PTS-STARTPTS','-vn','-ar','44100','-ac','2','-c:a','pcm_s16le',str(out/'sacred-idle.wav')],check=True,capture_output=True)
subprocess.run([ffmpeg,'-y','-i',str(out/'sacred-idle.mp4'),'-frames:v','1',str(out/'sacred-poster.jpg')],check=True,capture_output=True)
print('Sacred video clips and synchronized scrub audio prepared')
