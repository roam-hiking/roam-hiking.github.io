"""Main thumbnail: the DSLR photo itself, left part painted with ROAM-style risk colours (like the page's slider)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
exec(open("make.py").read().split("# --- Main film")[0])   # helpers: text, pill, W, H
base = Image.open("zer/a_base.jpg").convert("RGB")
p = np.load("zer/a_prob.npy")                      # CLIPSeg, only used to cut out the robot
# risk layer from ROAM itself: SAN + the Zermatt mission's VLM label table, plus large_rock_outcrop / mountain / sky (~/.cache/roam-san/run_roam.py)
risk = np.load("zer/out_full2.npz")["risk"].astype(np.float32)
blob = np.asarray(Image.fromarray(((p[5] > p[:5].max(0)) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(25))) > 0
from scipy import ndimage
_, (iy, ix) = ndimage.distance_transform_edt(blob, return_indices=True)
risk = risk[iy, ix]                                                   # robot (ROAM rates it high) -> nearest ground value
risk = ndimage.median_filter(risk, size=7)
path = np.load("zer/out_full2.npz")["argmax"] == 0                   # SAN gravel_path label
path = ndimage.binary_opening(path, iterations=3)
path = ndimage.binary_fill_holes(ndimage.binary_closing(path, iterations=25, border_value=0))
path = ndimage.binary_opening(path, iterations=6)
risk[path] = np.minimum(risk[path], np.median(risk[path]))           # no grass holes inside the trail
lo_r, hi_r = np.percentile(risk, 1), np.percentile(risk, 99.5)
risk = ((risk - lo_r) / (hi_r - lo_r)).clip(0, 1)                     # stretch to the full colour range
risk = np.where(risk > .5, .5 + .5 * np.sqrt(np.maximum(risk - .5, 0) / .5), risk)  # push risky areas towards full red
# coolwarm-ish ramp: blue -> neutral -> red
lo, mid, hi = np.array([45, 70, 210.]), np.array([225, 225, 220.]), np.array([200, 20, 40.])
r = risk[..., None]; col = np.where(r < .5, lo + (mid - lo) * (r / .5), mid + (hi - mid) * ((r - .5) / .5))
# robot stays real: CLIPSeg blob refined by colour (red body, dark joints)
a = np.asarray(base).astype(np.float32); R, G, Bl = a[..., 0], a[..., 1], a[..., 2]
robot = (p[5] > p[:5].max(0)) & (((R > 120) & (R > G * 1.6)) | (a.max(-1) < 75) | ((abs(R - G) < 14) & (abs(G - Bl) < 14) & (a.mean(-1) > 150)))
robot = np.asarray(Image.fromarray((robot * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))) / 255.
alpha = 0.58 * (1 - robot)[..., None]
painted = a * (1 - alpha) + col * alpha
SPLIT = 700
out = a.copy(); out[:, :SPLIT] = painted[:, :SPLIT]
img = Image.fromarray(out.clip(0, 255).astype(np.uint8))
# darken the top for the headline
g = Image.new("L", (W, H)); d = ImageDraw.Draw(g)
for i in range(300): d.line([(0, i), (W, i)], fill=int(140 * (1 - i / 300) ** 1.4))
img = Image.composite(Image.new("RGB", (W, H), (6, 14, 28)), img, g).convert("RGBA")
d = ImageDraw.Draw(img)
d.line([(SPLIT, 268), (SPLIT, H)], fill="white", width=4)
d.ellipse([SPLIT - 26, 560 - 26, SPLIT + 26, 560 + 26], fill="white")
f = ImageFont.truetype(B, 30); d.text((SPLIT, 558), "‹ ›", font=f, fill=(20, 20, 30), anchor="mm")
pill(d, (SPLIT - 196, 660), "RISK IMAGE", 22, bg=(15, 20, 30))
pill(d, (SPLIT + 18, 660), "CAMERA", 22, bg=(15, 20, 30))
X = 56
text(d, (X, 40), "ROBOTS THAT HIKE", 76)
text(d, (X, 118), "WITH COMMON SENSE", 76, fill=(255, 214, 102))
pill(d, (X + 2, 214), "ROAM  ·  SCIENCE ROBOTICS 2026", 26)
img.convert("RGB").save("roam-yt-main.jpg", quality=92)
Image.fromarray((robot * 255).astype(np.uint8)).save("zer/a_robotmask.png")
