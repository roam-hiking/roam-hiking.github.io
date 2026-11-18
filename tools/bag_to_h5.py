"""Pull the topics the page needs out of a raw ROS 1 bag into a compact h5 with the same layout as the full
recordings (so tools/build_vlm_moments.py and tools/build_robotcam.py read it unchanged). For Zermatt segments
that exist only as raw bags (14 Aug 13:15, 15 Aug 11:06 and 11:59).

    uv run --with rosbags --with h5py --with numpy --with pillow python tools/bag_to_h5.py <bag> <out.h5>

Kept: lmm_nav_ros/response, the RTK fix, user_command_relay/twist_input, hdr_camera_front/lmm_nav_sem (risk
channel only, float16) and only those front-camera frames whose header stamp equals a risk layer's stamp
(re-encoded at 768x512), streamed to disk. time = header stamp, msg_t = bag receive time.
"""
import base64, io, sys
import h5py, numpy as np
from PIL import Image
from rosbags.highlevel import AnyReader
from pathlib import Path

CAM, SEM = "/hdr_camera_front/image_raw/compressed", "/hdr_camera_front/lmm_nav_sem"
RESP, GPS, CMD = "/lmm_nav_ros/response", "/rtk_gps_driver/position_receiver_0/ros/navsatfix", "/user_command_relay/twist_input"

def stamp(msg):
    h = getattr(msg, "header", None)
    return h.stamp.sec + h.stamp.nanosec * 1e-9 if h is not None else None

def main(bag, out):
    from collections import OrderedDict
    resp, gps, cmd = [], [], []
    cams = OrderedDict()   # camera frames of the last few seconds, by header stamp: the risk layer arrives ~0.4 s after its frame
    with AnyReader([Path(bag)]) as r, h5py.File(out, "w") as h:
        conns = [c for c in r.connections if c.topic in (CAM, SEM, RESP, GPS, CMD)]
        print({c.topic: c.msgcount for c in conns}, flush=True)
        S = "hdr_camera_front/lmm_nav_sem/"; C = "hdr_camera_front/image_raw/compressed/"
        sem_img = None; st, smt, ct, cmt, cimg = [], [], [], [], h.create_dataset(C + "image", (0,), maxshape=(None,), dtype=h5py.string_dtype(encoding="ascii"))
        n = 0
        for c, t, raw in r.messages(connections=conns):
            m = r.deserialize(raw, c.msgtype); tt = t * 1e-9; n += 1
            if c.topic == RESP: resp.append((tt, m.data))
            elif c.topic == GPS: gps.append((stamp(m) or tt, tt, m.latitude, m.longitude))
            elif c.topic == CMD: cmd.append(stamp(m) or tt)
            elif c.topic == CAM:
                cams[round(stamp(m), 6)] = (tt, bytes(m.data))
                while cams and next(iter(cams)) < stamp(m) - 8: cams.popitem(last=False)
            elif c.topic == SEM:
                s0 = stamp(m); cam = cams.get(round(s0, 6))
                if cam is None: continue                       # no camera frame with exactly this stamp: skip
                a = np.frombuffer(bytes(m.data), np.float32).reshape(m.height, m.width, -1)[..., :1].astype(np.float16)
                if sem_img is None: sem_img = h.create_dataset(S + "image", (0,) + a.shape, maxshape=(None,) + a.shape, dtype=np.float16, chunks=(1,) + a.shape, compression="gzip", compression_opts=4)
                k = sem_img.shape[0]; sem_img.resize(k + 1, 0); sem_img[k] = a; st.append(s0); smt.append(tt)
                im = Image.open(io.BytesIO(cam[1])).convert("RGB").resize((768, 512), Image.LANCZOS); b = io.BytesIO(); im.save(b, "JPEG", quality=88)
                cimg.resize(k + 1, 0); cimg[k] = base64.b64encode(b.getvalue()).decode(); ct.append(s0); cmt.append(cam[0])
            if n % 20000 == 0: print(n, "messages,", len(st), "pairs", flush=True)
        h[S + "time"] = np.array(st); h[S + "msg_t"] = np.array(smt); h[C + "time"] = np.array(ct); h[C + "msg_t"] = np.array(cmt)
        h["lmm_nav_ros/response/msg_t"] = np.array([x[0] for x in resp]); h.create_dataset("lmm_nav_ros/response/data", data=[x[1] for x in resp], dtype=h5py.string_dtype())
        g = "rtk_gps_driver/position_receiver_0/ros/navsatfix/"
        for key, i in (("time", 0), ("msg_t", 1), ("latitude", 2), ("longitude", 3)): h[g + key] = np.array([x[i] for x in gps])
        h["user_command_relay/twist_input/time"] = np.array(cmd)
        print(f"wrote {out}: {len(st)} camera+risk pairs, {len(resp)} answers, {len(gps)} fixes, {len(cmd)} commands", flush=True)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
