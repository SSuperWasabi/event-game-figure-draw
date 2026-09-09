from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'.tools'))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
source=root/'zeratu summon_34.mp4'   # 1080x1440 HEVC 10-bit original with 112-row black bars top and bottom; cropped to 1080x1216 and re-encoded to 8-bit H.264 for browsers
out=root/'app/assets/figure'
subprocess.run([ffmpeg,'-y','-i',str(source),'-vf','crop=1080:1216:0:112,format=yuv420p','-c:v','libx264','-preset','slow','-crf','22','-profile:v','high','-level','4.1','-g','60','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',str(out/'zeratu-summon.mp4')],check=True,capture_output=True)
subprocess.run([ffmpeg,'-y','-i',str(out/'zeratu-summon.mp4'),'-frames:v','1','-q:v','3',str(out/'zeratu-summon.jpg')],check=True,capture_output=True)
subprocess.run([ffmpeg,'-y','-i',str(source),'-vn','-ar','44100','-ac','2','-c:a','pcm_s16le',str(out/'zeratu-summon.wav')],check=True,capture_output=True)
print('Zeratu summon clip, poster and Web Audio track prepared')
