"""Record a screen demo of a route explorer (for the main-page teaser). usage: demo_rec2.py hike outdir
Frames from Chrome's screencast -> review/demo/frames/*.jpg + frames.json (timestamps)."""
import asyncio, base64, json, os, shutil, sys
from playwright.async_api import async_playwright
HIKE = sys.argv[1]; DIR = sys.argv[2]; OUT = f"{DIR}/frames"; shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
CSS_T = """
.nav,.draft-bar,[class^=rvw],[class*=' rvw'],.rvw-fab,.rvw-count,.rvw-pins{display:none!important}
html,body{overflow:hidden!important}
#hike-{HIKE} .explorer{position:fixed!important;inset:0;z-index:9000;background:var(--night);padding:18px 24px;overflow:hidden}
#hike-{HIKE} .explorer{padding:14px 24px!important}
#hike-{HIKE} .rx-vlm-labels,#hike-{HIKE} .rx-vlm-n,#hike-{HIKE} .rx-tools,#hike-{HIKE} .rx-sel{display:none!important}
#hike-{HIKE} .rx-prof{height:96px!important}
#hike-{HIKE} .rx-src{display:none}
#hike-{HIKE} .rx-pip-cap{display:none}
#fakecur{position:fixed;z-index:10000;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;transition:transform .12s}
#fakecur.down{transform:scale(.8)}
"""
CSS = CSS_T.replace("{HIKE}", HIKE)
CUR = """(() => { const c = document.createElement('div'); c.id = 'fakecur';
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#fff" stroke="#0f1e26" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.append(c);
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => c.classList.add('down'), true); addEventListener('mouseup', () => c.classList.remove('down'), true); })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", args=["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        try:
            pg = await b.new_page(viewport={"width": 1440, "height": 900})
            cdp = await pg.context.new_cdp_session(pg); frames = []
            async def on_frame(ev):
                i = len(frames); fn = f"{OUT}/{i:05d}.jpg"
                open(fn, "wb").write(base64.b64decode(ev["data"])); frames.append([ev["metadata"]["timestamp"], fn])
                await cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
            cdp.on("Page.screencastFrame", lambda ev: asyncio.ensure_future(on_frame(ev)))
            async def scenario(rec):
                await pg.goto(f"http://localhost:8792/expeditions.html?take={int(rec)}#hike-{HIKE}", wait_until="load")
                sel = f"#hike-{HIKE} .explorer"
                await pg.wait_for_function(f"document.querySelector('{sel}')._map?.loaded()", timeout=60000)
                await pg.add_style_tag(content=CSS); await pg.evaluate(CUR)
                await pg.evaluate(f"document.querySelector('{sel}')._map.resize()")
                await pg.wait_for_timeout(9000)   # tiles + the settle/resize pass
                ex = pg.locator(sel)
                async def at(loc, fx=.5, fy=.5):
                    bb = await loc.bounding_box(); return bb["x"] + bb["width"] * fx, bb["y"] + bb["height"] * fy
                async def move(x, y, steps=28): await pg.mouse.move(x, y, steps=steps)
                async def wait(s): await pg.wait_for_timeout(int(s * 1000))
                x, y = await at(ex.locator('.rx-prof'), .01, .5); await pg.mouse.move(x, y); await pg.wait_for_timeout(400)   # redraw the profile at its new width, robot at the start
                await pg.mouse.move(640, 200); await pg.wait_for_timeout(400)
                if rec: await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 88, "maxWidth": 1440, "maxHeight": 900})
                await wait(1.6)
                play = ex.locator(".rx-play")
                await move(*await at(play)); await wait(.3); await pg.mouse.down(); await pg.mouse.up()
                await wait(13)                                          # camera flies to the robot, both cameras play, the panel crossfades
                await move(*await at(play)); await wait(.2); await pg.mouse.down(); await pg.mouse.up(); await wait(.6)   # pause
                prof = ex.locator(".rx-prof")
                x, y = await at(prof, .80, .55); await move(x, y, 34); await wait(.3); await pg.mouse.down(); await pg.mouse.up()
                await wait(3.4)                                         # long jump: the camera rises and comes back down
                x, y = await at(prof, .45, .55); await move(x, y, 30); await wait(.3); await pg.mouse.down(); await pg.mouse.up()
                await wait(3.4)
            await scenario(False)   # warm-up: tiles and video land in the cache
            await scenario(True)
            await cdp.send("Page.stopScreencast"); await pg.wait_for_timeout(300)
            json.dump(frames, open(f"{DIR}/frames.json", "w")); print(len(frames), "frames", round(frames[-1][0] - frames[0][0], 1), "s")
        finally: await b.close()
asyncio.run(main())
