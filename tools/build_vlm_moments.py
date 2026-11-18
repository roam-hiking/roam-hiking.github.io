"""Logged VLM moments along each hike, for the route explorers on the main page and the 3D Expedition.

For every VLM answer in the recorded h5 files: the robot's RTK-GPS position at that time, the nearest
point of the published route, the answer's first sentence and its label scores, the front camera frame and
the risk layer (coolwarm over the camera, as on the rest of the page). Thinned to one moment per MIN_GAP m.

Two steps, because only hand-picked moments go on the page (no interventions, risk images that look right):
    uv run --with h5py --with pillow --with numpy python tools/build_vlm_moments.py cand zermatt|seealpsee
        -> review/vlmcand/<hike>/: candidates c<id>-{cam,risk}.jpg, cand.json and contact sheets to pick from
    python3 tools/build_vlm_moments.py publish zermatt|seealpsee      (needs only numpy + pillow-free stdlib)
        -> the ids listed in tools/vlm_picks.json go to static/data/<hike>-vlm.json and static/img/vlm/<hike>/<n>-{cam,risk}.jpg
Answers within NEAR_CMD s of an operator command (user_command_relay/twist_input) are never candidates.
"""
import base64, io, json, math, os, re, sys
import h5py, numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
BAGS = "/run/media/takahiro/takahiroSSD/nature_hiking/rosbags"
HIKES = {
    # every full recording (with camera, risk layer and VLM answers); 14 Aug 13:15 and 15 Aug 11:06 / 11:59 exist only as stripped command_hdf5
    "zermatt": dict(files=["zermatt/2024-08-14-12-51-55-merged.h5", "zermatt/map_o3d/2024-08-14-13-47-27-merged.h5",
                           "zermatt/2024-08-15-09-47-11-merged.h5", "zermatt/2024-08-15-10-06-54-merged.h5"], gap=30),
    "seealpsee": dict(files=["seealpsee/seealpsee1.h5", "seealpsee/seealpsee2.h5", "seealpsee/seealpsee4.h5"], gap=12),
}
COOLWARM = np.array([[58, 76, 192], [141, 175, 253], [221, 220, 219], [243, 152, 121], [179, 3, 38]], float)
W, H = 640, 427
NEAR_CMD = 30

def coolwarm(x):
    x = np.clip(x, 0, 1) * (len(COOLWARM) - 1); k = np.minimum(np.floor(x).astype(int), len(COOLWARM) - 2); t = (x - k)[..., None]
    return COOLWARM[k] * (1 - t) + COOLWARM[k + 1] * t

def summary(text):
    """The answer's prose before its JSON, shortened to about two sentences; the JSON's "memory" line when there is no prose."""
    s = text.split("Response:", 1)[-1].strip()
    strip = lambda x: re.sub(r"^(Analyzing|Based on|From) the (provided )?images?( provided)?,\s*", "", x.strip(), flags=re.I)
    prose = strip(re.split(r"```|\{", s, maxsplit=1)[0])
    if len(prose) < 40 or re.search(r"(the following|here (is|are)|below)", prose[:90], re.I):   # a list of labels follows: use the answer's own summary line
        i = s.find("{")
        try: prose = strip(json.JSONDecoder().raw_decode(s[i:])[0].get("memory", "")) if i >= 0 else ""
        except ValueError: prose = ""
    prose = re.sub(r"\s*(Here is|Below is)[^.]*:?$", "", prose)
    out = ""
    for x in re.split(r"(?<=[.!?])\s+", prose):
        if len(out) + len(x) > 230 and out: break
        out = (out + " " + x).strip()
    return out[:1].upper() + out[1:]

def labels(text):
    i = text.find("{")
    if i < 0: return []
    try: js, _ = json.JSONDecoder().raw_decode(text[i:])
    except ValueError: return []
    est = js.get("label_estimation", js)
    out = []
    for name, v in est.items():
        if isinstance(v, dict) and "risk" in v:
            out.append([name, round(float(v.get("risk", 0)), 2), round(float(v.get("steppable", 0)), 2), round(float(v.get("preferred_area", 0)), 2)])
    return out

def cand(hike):
    cfg = HIKES[hike]
    route = json.load(open(os.path.join(ROOT, f"static/data/{hike}-route.json")))["points"]
    R = np.array(route); lat0 = math.radians(R[0, 0])
    def to_m(lat, lon): return np.stack([(lat - R[0, 0]) * 111320, (lon - R[0, 1]) * 111320 * math.cos(lat0)], -1)
    RM = to_m(R[:, 0], R[:, 1])
    found = []
    for rel in cfg["files"]:
        with h5py.File(os.path.join(BAGS, rel), "r") as h:
            rt = h["lmm_nav_ros/response/msg_t"][:]; rd = h["lmm_nav_ros/response/data"]
            cmd = h["user_command_relay/twist_input/msg_t"][:] if "user_command_relay/twist_input/msg_t" in h else np.array([])
            g = "rtk_gps_driver/position_receiver_0/ros/navsatfix/"
            gt = h[g + "msg_t"][:]; glat = h[g + "latitude"][:]; glon = h[g + "longitude"][:]
            n0 = len(found); skipped = 0
            for k, t in enumerate(rt):
                if len(cmd) and np.min(np.abs(cmd - t)) < NEAR_CMD: skipped += 1; continue
                j = int(np.clip(np.searchsorted(gt, t), 1, len(gt) - 1))
                if min(abs(gt[j] - t), abs(gt[j - 1] - t)) > 3 or not np.isfinite(glat[j]): continue
                d = np.hypot(*(RM - to_m(glat[j], glon[j])).T); i = int(d.argmin())
                if d[i] > 30: continue
                text = rd[k].decode() if isinstance(rd[k], bytes) else str(rd[k])
                lab = labels(text)
                if lab: found.append(dict(t=float(t), i=i, km=round(R[i, 3] / 1000, 3), text=summary(text), labels=lab, src=rel, k=k))
        print(f"{rel}: {len(found) - n0} on route, {skipped} skipped near operator commands")
    found.sort(key=lambda m: (m["i"], m["t"]))
    kept = []
    for m in found:
        if not kept or R[m["i"], 3] - R[kept[-1]["i"], 3] >= cfg["gap"]: kept.append(m)
    out = os.path.join(ROOT, f"review/vlmcand/{hike}"); os.makedirs(out, exist_ok=True)
    for c, m in enumerate(kept):
        m["id"] = c
        if os.path.exists(f"{out}/c{c:03d}-risk.jpg") and "--images" not in sys.argv: continue
        with h5py.File(os.path.join(BAGS, m["src"]), "r") as h:
            # Pair by HEADER stamps, never by arrival (msg_t): the risk layer arrives ~0.4 s after the camera frame it was
            # computed from, and its header stamp is that frame's stamp. Take the first risk layer after the answer,
            # then the camera frame with exactly that stamp; no exact match -> no moment.
            st = h["hdr_camera_front/lmm_nav_sem/time"][:]; j = int(np.clip(np.searchsorted(st, m["t"]), 0, len(st) - 1))
            ct = h["hdr_camera_front/image_raw/compressed/time"][:]; ci = int(np.argmin(np.abs(ct - st[j])))
            if abs(ct[ci] - st[j]) > 1e-3: print(f"  c{c:03d}: no camera frame with the risk layer's stamp, skipped"); m["bad"] = True; continue
            cam = Image.open(io.BytesIO(base64.b64decode(h["hdr_camera_front/image_raw/compressed/image"][ci]))).convert("RGB").resize((W, H), Image.LANCZOS)
            risk = h["hdr_camera_front/lmm_nav_sem/image"][j][..., 0]
        if risk.shape != (H, W): risk = np.asarray(Image.fromarray(risk.astype(np.float32)).resize((W, H)))
        over = (np.asarray(cam, float) * .4 + coolwarm(risk) * .6).clip(0, 255).astype(np.uint8)
        cam.save(f"{out}/c{c:03d}-cam.jpg", quality=76, optimize=True, progressive=True)
        Image.fromarray(over).save(f"{out}/c{c:03d}-risk.jpg", quality=76, optimize=True, progressive=True)
    kept = [m for m in kept if not m.get("bad")]
    json.dump(kept, open(f"{out}/cand.json", "w"), indent=0)
    # contact sheets: camera | risk per candidate, 4 per row, 24 per sheet
    from PIL import ImageDraw
    tw, th = 300, 200
    for s0 in range(0, len(kept), 24):
        part = kept[s0:s0 + 24]; rows = (len(part) + 3) // 4
        sheet = Image.new("RGB", (4 * (2 * tw + 12), rows * (th + 4)), "white"); dr = ImageDraw.Draw(sheet)
        for q, m in enumerate(part):
            x, y = (q % 4) * (2 * tw + 12), (q // 4) * (th + 4)
            sheet.paste(Image.open(f"{out}/c{m['id']:03d}-cam.jpg").resize((tw, th)), (x, y)); sheet.paste(Image.open(f"{out}/c{m['id']:03d}-risk.jpg").resize((tw, th)), (x + tw, y))
            dr.rectangle((x, y, x + 120, y + 18), fill="black"); dr.text((x + 4, y + 3), f"c{m['id']:03d} km {m['km']:.2f}", fill="white")
        sheet.save(f"{out}/sheet-{s0 // 24}.jpg", quality=80)
    print(hike, len(kept), "candidates, km", kept[0]["km"], "-", kept[-1]["km"])

def publish(hike):
    out = os.path.join(ROOT, f"review/vlmcand/{hike}"); kept = {m["id"]: m for m in json.load(open(f"{out}/cand.json"))}
    picks = json.load(open(os.path.join(ROOT, "tools/vlm_picks.json")))[hike]
    dst = os.path.join(ROOT, f"static/img/vlm/{hike}")
    import shutil; shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
    ms = sorted((kept[c] for c in picks), key=lambda m: m["i"])
    for n, m in enumerate(ms):
        for kind in ("cam", "risk"): shutil.copy(f"{out}/c{m['id']:03d}-{kind}.jpg", f"{dst}/{n:03d}-{kind}.jpg")
        m["n"] = n
    data = dict(hike=hike, source="lmm_nav_ros/response + RTK GPS + hdr_camera_front from the recorded h5 files; hand-picked (tools/vlm_picks.json), none near an operator command",
                moments=[dict(n=m["n"], i=m["i"], km=m["km"], t=round(m["t"], 1), text=m["text"], labels=m["labels"]) for m in ms])
    json.dump(data, open(os.path.join(ROOT, f"static/data/{hike}-vlm.json"), "w"), separators=(",", ":"))
    print(hike, len(ms), "moments published")

if __name__ == "__main__":
    {"cand": cand, "publish": publish}[sys.argv[1]](sys.argv[2])
