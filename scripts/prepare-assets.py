from pathlib import Path
from PIL import Image
import sys, subprocess

root = Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS = 260_000_000
out = root / 'app/assets/figure'
out.mkdir(parents=True, exist_ok=True)
for source, name, size in [
    ('SWC2026_Scroll_nobg.png', 'scroll.webp', 1000),
    ('SWC2026_Scroll_1000px.png', 'scroll-card.webp', 640),
    ('제라투 제품 썸네일.png', 'zeratu.webp', 1000),
    ('SWC2026_ArenaBG.jpg', 'arena.webp', 1500),
]:
    with Image.open(root / source) as im:
        if im.format == 'JPEG': im.draft('RGB', (size, size))
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
        im.save(out / name, 'WEBP', quality=88, method=6)
        print(name, im.size, (out/name).stat().st_size)

sys.path.insert(0, str(root/'.tools'))
try:
    import imageio_ffmpeg
    scroll_source=root/'scroll looping_2.mp4'
    if scroll_source.exists():
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',str(scroll_source),'-vf','scale=720:720','-an','-c:v','libx264','-crf','24','-g','1','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'scroll-looping-2.mp4')],check=True,capture_output=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loop', '1', '-i', str(out/'arena.webp'), '-t', '8', '-vf', 'scale=-2:1280,crop=720:1280:x=(iw-ow)/2+30*sin(2*PI*t/8):y=0', '-r', '24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', '-an', str(out/'idle.mp4')], check=True, capture_output=True)
    target = root/'.tools/reference-frames'
    target.mkdir(parents=True, exist_ok=True)
    frames=[]
    for sec in range(4,12):
        path=target/f'{sec}.jpg'
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-ss', str(sec), '-i', str(root/'gatcha reference_draw sequence.mov'), '-frames:v', '1', '-vf', 'scale=270:-1', str(path)], check=True, capture_output=True)
        frames.append(Image.open(path).convert('RGB'))
    sheet=Image.new('RGB',(270*4,frames[0].height*2))
    for i, frame in enumerate(frames): sheet.paste(frame,((i%4)*270,(i//4)*frame.height))
    sheet.save(target/'contact.jpg')
    print(target/'contact.jpg')
except ImportError:
    print('Video extraction tool unavailable')
