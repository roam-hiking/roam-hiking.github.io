"""Build the co-author review copy of the page as a shared Claude page.

The shared page loads nothing from other sites and allows at most 15 MB per file, so this
copy differs from the real site in three ways:
  - the oversized videos come from share/encode_big.sh (lower bitrate, same length);
  - the 3D map uses the bundled basemaps from share/make_basemaps.py (2D, satellite only);
  - MapLibre's stylesheet is inlined.
Run encode_big.sh and make_basemaps.py first, then: python3 share/build.py
Output: share/site/index.html and expeditions.html plus share/site/static/... (only the files the page uses).
"""
import json, os, re, shutil

ROOT = os.path.join(os.path.dirname(__file__), "..")
SITE = os.path.join(ROOT, "share/site")
LIMIT = 15 * 1024 * 1024


def must_sub(pattern, repl, text, count=1, flags=0):
    new, n = re.subn(pattern, repl, text, count=count, flags=flags)
    if n == 0:
        raise SystemExit(f"pattern not found: {pattern[:60]}")
    return new


def inline(html):
    """Put the page's own stylesheet and scripts back inline, as one file per page."""
    html = must_sub(r'<link rel="stylesheet" href="static/css/site.css">',
                    lambda m: "<style>\n" + open(os.path.join(ROOT, "static/css/site.css")).read() + "</style>", html)
    return re.sub(r'<script src="(static/js/[a-z]+\.js)"></script>',
                  lambda m: "<script>\n" + open(os.path.join(ROOT, m.group(1))).read() + "</script>", html)


html = inline(open(os.path.join(ROOT, "index.html")).read())

# The publish step wraps the main page in its own document and viewport meta
html = must_sub(r"<!doctype html>\s*<html[^>]*>\s*<head>\s*", "", html, flags=re.I)
html = must_sub(r'<meta name="viewport"[^>]*>\s*', "", html)
html = must_sub(r"<title>[^<]*</title>", "<title>ROAM Project Page</title>", html)
html = must_sub(r"</head>\s*<body>", "", html)
html = must_sub(r"</body>\s*</html>\s*$", "", html)
html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
open(os.path.join(SITE, "index.html"), "w").write(html)

# The route explorer page is served as a supporting file, so it keeps its own document skeleton
xp = inline(open(os.path.join(ROOT, "expeditions.html")).read())

# Stylesheets only load from Google Fonts: inline MapLibre's
css = open(os.path.join(ROOT, "share/vendor/maplibre-gl-5.24.0.css")).read()
xp = must_sub(r'<link rel="stylesheet" href="https://cdnjs[^"]*maplibre-gl.min.css">', lambda m: "<style>" + css + "</style>", xp)
xp = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", xp)

# Map: one bundled satellite image instead of remote tiles and terrain
bases = {h: json.load(open(os.path.join(SITE, f"static/img/basemap/{h}.json")))["coordinates"] for h in ("zermatt", "seealpsee")}
xp = must_sub(
    r'style: \{ version: 8, sources: \{.*?sky-horizon-blend.*?\} \}\n  \}\);',
    lambda m: ('style: { version: 8, sources: {\n'
               '        sat: { type: "image", url: new URL(`static/img/basemap/${data.name}.jpg`, location.href).href, coordinates: BASEMAPS[data.name] } },\n'
               '      layers: [{ id: "base", type: "raster", source: "sat" }] }\n  });\n'
               '  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Imagery © Esri, Maxar, Earthstar Geographics" }));'),
    xp, flags=re.S)
xp = must_sub(r"attributionControl: \{ compact: true \}", "attributionControl: false", xp)
xp = must_sub(r'async function initExplorer\(el\) \{', lambda m: f"const BASEMAPS = {json.dumps(bases)};\n" + m.group(0), xp)
# Only satellite imagery and no terrain: keep a hidden, switched-off 3D button so the camera code runs as 2D,
# and keep the Follow button
xp = must_sub(r'baseBar\.innerHTML = \[\["sat".*?\'<button data-tilt aria-pressed="true">3D</button>(<button data-follow[^\']*</button>)\';',
              lambda m: 'baseBar.innerHTML = \'<button data-tilt aria-pressed="false" hidden></button>' + m.group(1) + '\';', xp, flags=re.S)
open(os.path.join(SITE, "expeditions.html"), "w").write(xp)

# Copy every file the page or its data refers to (encoded videos are already in place)
data = "".join(open(os.path.join(ROOT, "static/data", f)).read() for f in os.listdir(os.path.join(ROOT, "static/data")))
blob = html + xp + data
files = []
for root, _, names in os.walk(os.path.join(ROOT, "static")):
    for name in names:
        src = os.path.join(root, name)
        rel = os.path.relpath(src, ROOT)
        # Names the script builds at runtime: pin thumbnails (`${id}_t.jpg`), course-lab clips (`hg-${id}-${method}`)
        # and the mixed-route comparison (`nav-route-${method}`)
        runtime = name.endswith("_t.jpg") or name.startswith(("hg-", "nav-route-"))
        if rel not in blob and os.path.splitext(name)[0] not in blob and not runtime:
            continue
        dst = os.path.join(SITE, rel)
        if not os.path.exists(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
        files.append(rel)
files += [os.path.join("static/img/basemap", f) for f in ("zermatt.jpg", "seealpsee.jpg")]

too_big = [f for f in files if os.path.getsize(os.path.join(SITE, f)) > LIMIT]
if too_big:
    raise SystemExit(f"over 15 MB: {too_big}")
total = sum(os.path.getsize(os.path.join(SITE, f)) for f in files)

# Split into publish batches of at most 60 MB and 250 files
batches, cur, size = [], [], 0
for f in sorted(files, key=lambda f: os.path.getsize(os.path.join(SITE, f))):
    s = os.path.getsize(os.path.join(SITE, f))
    if cur and (size + s > 60e6 or len(cur) >= 250):
        batches.append(cur); cur, size = [], 0
    cur.append(f); size += s
batches.append(cur)
json.dump(batches, open(os.path.join(SITE, "batches.json"), "w"), indent=0)
print(f"{len(files)} files, {total / 1e6:.0f} MB, page {os.path.getsize(os.path.join(SITE, 'index.html')) / 1e3:.0f} kB, {len(batches)} batches")
