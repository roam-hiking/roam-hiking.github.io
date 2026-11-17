"""Grab frames every STEP seconds from a video into OUTDIR (GStreamer seek + pillow)."""
import sys, gi
from PIL import Image
gi.require_version("Gst", "1.0"); from gi.repository import Gst
src, outdir, step = sys.argv[1], sys.argv[2], float(sys.argv[3])
Gst.init(None)
p = Gst.parse_launch(f'filesrc location="{src}" ! qtdemux ! h264parse ! avdec_h264 ! videoconvert ! videoscale ! video/x-raw,format=RGB ! appsink name=s sync=false')
s = p.get_by_name("s"); p.set_state(Gst.State.PAUSED); p.get_state(Gst.CLOCK_TIME_NONE)
ok, dur = p.query_duration(Gst.Format.TIME); dur /= Gst.SECOND; print("dur", dur)
t = 0.0
while t < dur:
    p.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH | Gst.SeekFlags.ACCURATE, int(t * Gst.SECOND))
    p.get_state(Gst.CLOCK_TIME_NONE)
    smp = s.emit("pull-preroll"); caps = smp.get_caps().get_structure(0)
    w, h = caps.get_value("width"), caps.get_value("height")
    buf = smp.get_buffer(); ok, m = buf.map(Gst.MapFlags.READ)
    Image.frombytes("RGB", (w, h), bytes(m.data)).save(f"{outdir}/{int(t):04d}.jpg", quality=88); buf.unmap(m)
    t += step
p.set_state(Gst.State.NULL)
