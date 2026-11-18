"""Bake a terrain tile for the 3D expedition page (expedition.html): heights + aerial image over one bbox.

    uv run --with pillow --with numpy --with requests python tools/bake_terrain.py zermatt|seealpsee

Output in static/terrain/<hike>/:
  height.png  terrarium-encoded heights (R*256 + G + B/256 - 32768 m), a regular grid in Web Mercator over the bbox
  image.jpg   swisstopo SWISSIMAGE over exactly the same bbox (Web Mercator, north up)
  meta.json   bbox, grid size, metres per pixel, height range
Sources: AWS Terrain Tiles (terrarium, open data), swisstopo SWISSIMAGE (WMTS, © swisstopo).
"""
import io, json, math, os, sys
import numpy as np, requests
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
HIKES = {
    # bbox: lon0, lat0, lon1, lat1. Zermatt is wide enough to hold the Matterhorn; Seealpsee holds the Säntis.
    "zermatt": dict(bbox=(7.635, 45.963, 7.805, 46.025), zdem=13, zimg=15, grid=640),
    "seealpsee": dict(bbox=(9.335, 47.243, 9.435, 47.288), zdem=14, zimg=16, grid=640),
}
S = requests.Session(); S.headers["User-Agent"] = "roam-project-page bake (takahiro miki)"

def merc(lon, lat, z):   # fractional tile coords
    n = 2 ** z; x = (lon + 180) / 360 * n; y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def mosaic(url, z, bbox, tile=256, mode="RGB"):
    lon0, lat0, lon1, lat1 = bbox
    x0, y1 = merc(lon0, lat0, z); x1, y0 = merc(lon1, lat1, z)
    tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
    W, H = (tx1 - tx0 + 1) * tile, (ty1 - ty0 + 1) * tile
    out = Image.new(mode, (W, H))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            r = S.get(url.format(z=z, x=tx, y=ty), timeout=30); r.raise_for_status()
            out.paste(Image.open(io.BytesIO(r.content)).convert(mode).resize((tile, tile)), ((tx - tx0) * tile, (ty - ty0) * tile))
    crop = (round((x0 - tx0) * tile), round((y0 - ty0) * tile), round((x1 - tx0) * tile), round((y1 - ty0) * tile))
    return out.crop(crop)

def main(hike):
    c = HIKES[hike]; out = os.path.join(ROOT, f"static/terrain/{hike}"); os.makedirs(out, exist_ok=True)
    dem = mosaic("https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png", c["zdem"], c["bbox"])
    a = np.asarray(dem, np.float64); h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    gw = c["grid"]; gh = round(gw * h.shape[0] / h.shape[1])
    hg = np.asarray(Image.fromarray(h.astype(np.float32)).resize((gw, gh), Image.BILINEAR), np.float64)
    v = hg + 32768; R = np.floor(v / 256); G = np.floor(v - R * 256); B = np.round((v - R * 256 - G) * 256).clip(0, 255)
    Image.fromarray(np.stack([R, G, B], -1).astype(np.uint8)).save(f"{out}/height.png", optimize=True)
    img = mosaic("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg", c["zimg"], c["bbox"])
    if max(img.size) > 4096: img = img.resize((4096, round(4096 * img.size[1] / img.size[0])) if img.size[0] >= img.size[1] else (round(4096 * img.size[0] / img.size[1]), 4096), Image.LANCZOS)
    img.save(f"{out}/image.jpg", quality=80, optimize=True, progressive=True)
    lon0, lat0, lon1, lat1 = c["bbox"]; latm = (lat0 + lat1) / 2
    wm = (lon1 - lon0) * 111320 * math.cos(math.radians(latm))
    hm = (lat1 - lat0) * 111320   # Web Mercator is conformal: the grid's aspect matches true metres over this small area
    meta = dict(hike=hike, bbox=c["bbox"], grid=[gw, gh], width_m=round(wm, 1), height_m=round(hm, 1), zmin=round(float(hg.min()), 1), zmax=round(float(hg.max()), 1),
                image=list(img.size), source="heights: AWS Terrain Tiles (terrarium); image: swisstopo SWISSIMAGE")
    # Sharp images of the corridor around the route (the camera comes close there): the finest zoom whose image fits
    # 4096 px tall and two 4096 px images wide; split west/east when one is not enough.
    P = json.load(open(os.path.join(ROOT, f"static/data/{hike}-route.json")))["points"]
    db = (min(p[1] for p in P) - .006, min(p[0] for p in P) - .004, max(p[1] for p in P) + .006, max(p[0] for p in P) + .004)
    wpx = lambda z: (merc(db[2], db[1], z)[0] - merc(db[0], db[1], z)[0]) * 256
    hpx = lambda z: (merc(db[0], db[1], z)[1] - merc(db[0], db[3], z)[1]) * 256
    z = max(z for z in range(14, 19) if wpx(z) <= 2 * 4096 and hpx(z) <= 4096)
    parts = 1 if wpx(z) <= 4096 else 2
    meta["details"] = []
    for q in range(parts):
        x0 = db[0] + (db[2] - db[0]) * q / parts - (.0004 if q else 0); x1 = db[0] + (db[2] - db[0]) * (q + 1) / parts + (.0004 if q < parts - 1 else 0)
        bb = (x0, db[1], x1, db[3]); det = mosaic("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg", z, bb)
        fn = f"detail{q or ''}.jpg"; det.save(f"{out}/{fn}", quality=78, optimize=True, progressive=True)
        meta["details"].append(dict(file=fn, bbox=[round(x, 6) for x in bb], zoom=z, image=list(det.size)))
    meta.pop("detail", None)
    json.dump(meta, open(f"{out}/meta.json", "w"), indent=1)
    print(hike, "details", [(d["file"], d["zoom"], d["image"]) for d in meta["details"]])

if __name__ == "__main__":
    main(sys.argv[1])
