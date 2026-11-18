"""Robot-camera video sampled by distance along the route, for scroll-scrubbing on expedition.html.

From every full h5 recording of a hike: each risk layer (lmm_nav_sem) and the camera frame with exactly its header
stamp (never pair by arrival time), placed on the route by the RTK-GPS fix at that stamp. Frames during or within
60 s of a manual-driving stretch are skipped. Then one frame per STEP metres along the route: frame k shows the route at
s0 + k * STEP, so a page can seek to (s - s0) / STEP / FPS.

    uv run --with h5py --with pillow --with numpy python tools/build_robotcam.py zermatt|seealpsee
Writes review/robotcam/<hike>/{cam,risk}/%05d.jpg and static/data/<hike>-robotcam.json; encode with tools/encode_robotcam.sh.
"""
import base64, io, json, math, os, sys
import h5py, numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
BAGS = "/run/media/takahiro/takahiroSSD/nature_hiking/rosbags"
FILES = {
    "zermatt": ["zermatt/2024-08-14-12-51-55-merged.h5", "zermatt/map_o3d/2024-08-14-13-47-27-merged.h5",
                "zermatt/2024-08-15-09-47-11-merged.h5", "zermatt/2024-08-15-10-06-54-merged.h5"],
    "seealpsee": ["seealpsee/seealpsee1.h5", "seealpsee/seealpsee2.h5", "seealpsee/seealpsee4.h5"],
}
STEP = {"zermatt": 4.0, "seealpsee": 2.0}
W, H = 768, 512
def manual_spans(cmd, join=120, pad=60):
    """Operator joystick commands come in sparse bursts: commands less than `join` s apart are one manual stretch.
    Returns [start - pad, end + pad] per stretch; nothing inside one is shown (no interventions on the page)."""
    S = []
    for t in sorted(cmd):
        if S and t - S[-1][1] < join: S[-1][1] = t
        else: S.append([t, t])
    return [(a - pad, b + pad) for a, b in S]

def manual(t, spans): return any(a <= t <= b for a, b in spans)

COOLWARM = np.array([[58, 76, 192], [141, 175, 253], [221, 220, 219], [243, 152, 121], [179, 3, 38]], float)

def coolwarm(x):
    x = np.clip(x, 0, 1) * 4; k = np.minimum(np.floor(x).astype(int), 3); t = (x - k)[..., None]
    return COOLWARM[k] * (1 - t) + COOLWARM[k + 1] * t

def main(hike):
    P = np.array(json.load(open(os.path.join(ROOT, f"static/data/{hike}-route.json")))["points"])
    lat0 = math.radians(P[0, 0]); to_m = lambda la, lo: np.stack([(la - P[0, 0]) * 111320, (lo - P[0, 1]) * 111320 * math.cos(lat0)], -1)
    RM = to_m(P[:, 0], P[:, 1]); dist = P[:, 3]
    cands = []   # (s, file, risk index, camera index)
    for rel in FILES[hike]:
        with h5py.File(os.path.join(BAGS, rel), "r") as h:
            st = h["hdr_camera_front/lmm_nav_sem/time"][:]; ct = h["hdr_camera_front/image_raw/compressed/time"][:]
            g = "rtk_gps_driver/position_receiver_0/ros/navsatfix/"; gt = h[g + "time"][:]; gla = h[g + "latitude"][:]; glo = h[g + "longitude"][:]
            k = "user_command_relay/twist_input/time"; spans = manual_spans(h[k][:] if k in h else [])
            order = np.argsort(ct); cts = ct[order]; prev = None; n0 = len(cands)
            for j, t in enumerate(st):
                if manual(t, spans): continue
                c = int(np.clip(np.searchsorted(cts, t), 0, len(cts) - 1))
                c = min((c, max(0, c - 1)), key=lambda q: abs(cts[q] - t))
                if abs(cts[c] - t) > 1e-3: continue                      # no camera frame with this stamp
                k = int(np.clip(np.searchsorted(gt, t), 1, len(gt) - 1))
                if min(abs(gt[k] - t), abs(gt[k - 1] - t)) > 1 or not np.isfinite(gla[k]): continue
                d = np.hypot(*(RM - to_m(gla[k], glo[k])).T)
                if prev is not None:   # follow the route forward: no jumps to another branch that passes nearby
                    lo, hi = max(0, prev - 40), min(len(RM), prev + 80); i = lo + int(d[lo:hi].argmin())
                    if d[i] > 25: i = int(d.argmin())
                else: i = int(d.argmin())
                if d[i] > 25: continue
                prev = i; cands.append((float(dist[i]), rel, j, int(order[c])))
        print(f"{rel}: {len(cands) - n0} usable frames")
    cands.sort()
    S = np.array([c[0] for c in cands]); step = STEP[hike]
    s0, s1 = S.min(), S.max(); grid = np.arange(s0, s1, step)
    pick, gaps = [], []
    for s in grid:   # nearest frame in distance; a hole of more than 3 steps is a stretch without footage
        k = int(np.clip(np.searchsorted(S, s), 1, len(S) - 1)); k = k if abs(S[k] - s) < abs(S[k - 1] - s) else k - 1
        pick.append(cands[k]); gaps.append(abs(S[k] - s) > 20)   # under 40 m without a frame: show the nearest one
    out = os.path.join(ROOT, f"review/robotcam/{hike}"); os.makedirs(f"{out}/cam", exist_ok=True); os.makedirs(f"{out}/risk", exist_ok=True)
    files = {}
    try:
        for n, (s, rel, j, c) in enumerate(pick):
            h = files.get(rel) or files.setdefault(rel, h5py.File(os.path.join(BAGS, rel), "r"))
            cam = Image.open(io.BytesIO(base64.b64decode(h["hdr_camera_front/image_raw/compressed/image"][c]))).convert("RGB").resize((W, H), Image.LANCZOS)
            risk = h["hdr_camera_front/lmm_nav_sem/image"][j][..., 0]
            risk = np.asarray(Image.fromarray(risk.astype(np.float32)).resize((W, H)))
            cam.save(f"{out}/cam/{n:05d}.jpg", quality=90)
            Image.fromarray((np.asarray(cam, float) * .4 + coolwarm(risk) * .6).clip(0, 255).astype(np.uint8)).save(f"{out}/risk/{n:05d}.jpg", quality=90)
            if n % 200 == 0: print(n, "/", len(pick))
    finally:
        for h in files.values(): h.close()
    holes, k = [], 0
    while k < len(gaps):   # holes shorter than 40 m are dropped below
        if gaps[k]: k0 = k; k = next((q for q in range(k, len(gaps)) if not gaps[q]), len(gaps)); holes.append([round(s0 + k0 * step, 1), round(s0 + k * step, 1)])
        else: k += 1
    holes = [h for h in holes if h[1] - h[0] >= 40]
    json.dump(dict(hike=hike, step_m=step, fps=30, s0=round(float(s0), 1), frames=len(pick), holes=holes,
                   source="hdr_camera_front frames paired with lmm_nav_sem by header stamp; RTK GPS; none during or within 60 s of manual driving"),
              open(os.path.join(ROOT, f"static/data/{hike}-robotcam.json"), "w"), indent=1)
    print(hike, len(pick), "frames, km", round(s0 / 1000, 2), "-", round(s1 / 1000, 2), "holes", holes)

if __name__ == "__main__":
    main(sys.argv[1])
