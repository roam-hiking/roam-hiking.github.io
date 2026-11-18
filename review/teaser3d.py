"""Render the 3D-map teaser stills for the main page. usage: teaser3d.py '{"zermatt": {camera}, ...}'"""
import sys, json, asyncio
from playwright.async_api import async_playwright
CAMS = json.loads(sys.argv[1])
HIDE = ".nav,.draft-bar,.rx-stage>div:last-child,.rx-base,.maplibregl-control-container,.rx-photo,.rx-pin,.rx-end{display:none!important}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", args=["--use-gl=angle","--use-angle=gl-egl","--ignore-gpu-blocklist"])
        try:
            pg = await b.new_page(viewport={"width": 1400, "height": 1000}, device_scale_factor=1)
            await pg.goto("http://localhost:8792/expeditions.html", wait_until="domcontentloaded")
            await pg.add_style_tag(content=HIDE)
            for key, cam in CAMS.items():
                hike = key.split("@")[0]; sel = f"#hike-{hike} .explorer"
                await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'center'}})")
                await pg.wait_for_function(f"document.querySelector('{sel}')._map && document.querySelector('{sel}')._map.loaded()", timeout=60000)
                await pg.wait_for_timeout(6000)
                await pg.evaluate("""([sel, cam]) => new Promise(r => { const el = document.querySelector(sel), m = el._map, c = m.getContainer();
                    c.style.width = '900px'; c.style.height = '900px'; c.style.flex = 'none'; m.resize();
                    m.getSource("done").setData(m.getSource("route").serialize().data); m.setPaintProperty("route-done","line-width",5.5); m.setPaintProperty("route-base","line-width",5.5); m.setPaintProperty("route-casing","line-width",11); m.jumpTo(cam); m.once('idle', () => { m.resize(); m.once('idle', r); m.triggerRepaint(); }); })""", [sel, cam])
                await pg.wait_for_timeout(2500)
                await pg.locator(f"{sel} .rx-map").screenshot(path=f"shots/teaser-{key}.png")
        finally:
            await b.close()
asyncio.run(main())
