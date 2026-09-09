from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'.tools'))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
source=root/'scroll looping_3.mp4'
out=root/'app/assets/figure'
# 30 fps timecode: idle through 03:10; opening starts at 03:11 (frame 101).
for name,trim,gop in [('scroll3-idle.mp4','trim=end_frame=101','30'),('scroll3-open.mp4','trim=start_frame=101','1')]:
    subprocess.run([ffmpeg,'-y','-i',str(source),'-vf',trim+',setpts=PTS-STARTPTS,scale=720:720','-an','-c:v','libx264','-crf','24','-g',gop,'-pix_fmt','yuv420p','-movflags','+faststart',str(out/name)],check=True,capture_output=True)
    print(name,(out/name).stat().st_size)
subprocess.run([ffmpeg,'-y','-i',str(out/'scroll3-idle.mp4'),'-frames:v','1',str(out/'scroll3-poster.jpg')],check=True,capture_output=True)
