import sys, gi
from PIL import Image
gi.require_version("Gst", "1.0"); from gi.repository import Gst
src, outdir = sys.argv[1], sys.argv[2]; ts = [float(x) for x in sys.argv[3:]]
Gst.init(None)
p = Gst.parse_launch(f'filesrc location="{src}" ! qtdemux ! h264parse ! avdec_h264 ! videoconvert ! video/x-raw,format=RGB ! appsink name=s sync=false')
s = p.get_by_name("s"); p.set_state(Gst.State.PAUSED); p.get_state(Gst.CLOCK_TIME_NONE)
for t in ts:
    p.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH | Gst.SeekFlags.ACCURATE, int(t * Gst.SECOND)); p.get_state(Gst.CLOCK_TIME_NONE)
    smp = s.emit("pull-preroll"); c = smp.get_caps().get_structure(0); b = smp.get_buffer(); ok, m = b.map(Gst.MapFlags.READ)
    Image.frombytes("RGB", (c.get_value("width"), c.get_value("height")), bytes(m.data)).save(f"{outdir}/{t:06.1f}.jpg", quality=92); b.unmap(m)
p.set_state(Gst.State.NULL)
