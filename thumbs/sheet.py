import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(d + "/*.jpg")); cols = 8; tw, th = 320, 180
rows = (len(fs) + cols - 1) // cols
S = Image.new("RGB", (cols * tw, rows * (th + 18)), "white"); D = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    x, y = i % cols * tw, i // cols * (th + 18)
    S.paste(Image.open(f).resize((tw, th)), (x, y)); D.text((x + 4, y + th + 2), os.path.basename(f)[:-4] + "s", fill="black")
S.save(out, quality=80)
