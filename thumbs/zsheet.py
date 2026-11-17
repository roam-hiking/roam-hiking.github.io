import glob, os
from PIL import Image, ImageDraw
fs = sorted(glob.glob("/run/media/takahiro/takahiroSSD/nature_hiking/pictures/*.JPG"))
tw, th, cols, per = 240, 160, 10, 150
for k in range(0, len(fs), per):
    ch = fs[k:k + per]
    S = Image.new("RGB", (cols * tw, ((len(ch) + cols - 1) // cols) * (th + 14)), "white"); D = ImageDraw.Draw(S)
    for i, f in enumerate(ch):
        try:
            im = Image.open(f); im.draft("RGB", (tw * 2, th * 2)); im = im.convert("RGB"); im.thumbnail((tw, th))
        except Exception: continue
        x, y = i % cols * tw, i // cols * (th + 14); S.paste(im, (x, y)); D.text((x + 3, y + th + 1), os.path.basename(f)[3:8], fill="black")
    S.save(f"zer/all_{k // per:02d}.jpg", quality=78); print(k, flush=True)
