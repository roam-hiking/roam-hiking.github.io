"""YouTube thumbnails (1280x720) for Movie 1 and the Seealpsee film."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
B = "/home/takahiro/Claude/roam-movie1/fonts/D-DIN-Bold.ttf"; R = "/home/takahiro/Claude/roam-movie1/fonts/D-DIN.ttf"
W, H = 1280, 720
RED = (230, 57, 44)

def fit(img, cx=0.5, cy=0.5, zoom=1.0):
    w, h = img.size; s = max(W / w, H / h) * zoom
    img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    x = round((img.width - W) * cx); y = round((img.height - H) * cy)
    return img.crop((x, y, x + W, y + H))

def shade(img, side, strength=200, frac=0.62):
    g = Image.new("L", (W, H)); d = ImageDraw.Draw(g)
    n = int(W * frac)
    for i in range(n):
        a = int(strength * (1 - i / n) ** 1.6)
        x = i if side == "left" else W - 1 - i
        d.line([(x, 0), (x, H)], fill=a)
    return Image.composite(Image.new("RGB", (W, H), (8, 12, 18)), img, g)

def text(d, xy, s, size, font=B, fill="white", shadow=True):
    f = ImageFont.truetype(font, size)
    if shadow:
        d.text((xy[0] + 3, xy[1] + 4), s, font=f, fill=(0, 0, 0, 150))
    d.text(xy, s, font=f, fill=fill); return f.getbbox(s)

def pill(d, xy, s, size, bg=RED, fg="white"):
    f = ImageFont.truetype(B, size); l, t, r, b = f.getbbox(s)
    x, y = xy; d.rounded_rectangle([x, y, x + r - l + 2 * 16, y + b - t + 2 * 10], 8, fill=bg)
    d.text((x + 16 - l, y + 10 - t), s, font=f, fill=fg)

def card(base, path, xy, w, label):
    im = Image.open(path).convert("RGB"); h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    sh = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([30, 34, w + 30, h + 34], 14, fill=(0, 0, 0, 140))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)), (xy[0] - 30, xy[1] - 30))
    fr = Image.new("RGBA", (w + 10, h + 10), (255, 255, 255, 255)); m = Image.new("L", fr.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w + 9, h + 9], 12, fill=255)
    base.paste(fr, (xy[0] - 5, xy[1] - 5), m)
    m2 = Image.new("L", (w, h), 0); ImageDraw.Draw(m2).rounded_rectangle([0, 0, w - 1, h - 1], 9, fill=255)
    base.paste(im, xy, m2)
    pill(ImageDraw.Draw(base), (xy[0] + 12, xy[1] + 12), label, 22, bg=(15, 20, 30))

# --- Main film: robot below the Matterhorn, with the VLM risk image it walks on
bg = shade(fit(Image.open("fine/m1/0258.0.jpg").convert("RGB"), cx=0.0, cy=0.5), "right", 215, 0.6).convert("RGBA")
card(bg, "/home/takahiro/Claude/roam-project/static/img/glance/matterhorn-risk.jpg", (860, 60), 360, "VLM RISK MAP")
d = ImageDraw.Draw(bg)
X = 735
text(d, (X, 330), "ROBOTS THAT", 70)
text(d, (X, 402), "HIKE WITH", 70)
text(d, (X, 474), "COMMON SENSE", 70, fill=(255, 214, 102))
pill(d, (X + 2, 585), "ROAM  ·  SCIENCE ROBOTICS 2026", 26)
bg.convert("RGB").save("roam-yt-main-frame.jpg", quality=92)

# --- Seealpsee documentary: robot leading the way past the cows
bg = shade(fit(Image.open("fine/sa/0128.0.jpg").convert("RGB"), cx=0.5, cy=0.5, zoom=1.0), "left", 210, 0.55).convert("RGBA")
d = ImageDraw.Draw(bg)
X = 60
pill(d, (X + 2, 70), "SEEALPSEE  ·  SWISS ALPS", 26)
text(d, (X, 140), "WE TOOK", 92)
text(d, (X, 232), "OUR ROBOT", 92)
text(d, (X, 324), "HIKING", 92, fill=(255, 214, 102))
text(d, (X + 2, 440), "2.4 km lake loop  ·  ROAM", 34, font=R)
bg.convert("RGB").save("roam-yt-seealpsee.jpg", quality=92)
