"""Stitch Esri World Imagery tiles around each hike route into one JPEG.

The shared Claude page cannot load map tiles from other sites, so the share build
uses these images as a MapLibre "image" source instead (2D, no terrain).
Writes share/site/static/img/basemap/<hike>.jpg and <hike>.json (corner coordinates).
Usage: python3 share/make_basemaps.py
"""
import io, json, math, os, time, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "share/site/static/img/basemap")
URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
MAX_PX = 4096  # keep under typical phone GPU texture size


def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def tile_lonlat(x, y, z):
    n = 2 ** z
    lon = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


def build(hike):
    pts = json.load(open(os.path.join(ROOT, f"static/data/{hike}-route.json")))["points"]
    lats, lons = [p[0] for p in pts], [p[1] for p in pts]
    pad_lat, pad_lon = (max(lats) - min(lats)) * .2 + .002, (max(lons) - min(lons)) * .2 + .003
    s, n, w, e = min(lats) - pad_lat, max(lats) + pad_lat, min(lons) - pad_lon, max(lons) + pad_lon
    for z in range(17, 12, -1):
        x0, y0 = tile_xy(n, w, z); x1, y1 = tile_xy(s, e, z)
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        if max(x1 - x0 + 1, y1 - y0 + 1) * 256 <= MAX_PX:
            break
    img = Image.new("RGB", ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            req = urllib.request.Request(URL.format(z=z, x=tx, y=ty), headers={"User-Agent": "roam-project-page-build"})
            img.paste(Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGB"), ((tx - x0) * 256, (ty - y0) * 256))
            time.sleep(.05)
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, f"{hike}.jpg"), quality=82, optimize=True, progressive=True)
    nw, se = tile_lonlat(x0, y0, z), tile_lonlat(x1 + 1, y1 + 1, z)
    coords = [[nw[0], nw[1]], [se[0], nw[1]], [se[0], se[1]], [nw[0], se[1]]]
    json.dump({"zoom": z, "coordinates": coords}, open(os.path.join(OUT, f"{hike}.json"), "w"))
    print(hike, "z", z, img.size, round(os.path.getsize(os.path.join(OUT, f"{hike}.jpg")) / 1e6, 1), "MB")


if __name__ == "__main__":
    for h in ("zermatt", "seealpsee"):
        build(h)
