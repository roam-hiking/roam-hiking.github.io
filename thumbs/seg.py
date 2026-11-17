"""CLIPSeg the cropped DSLR thumbnail into scene classes; saves per-class probabilities."""
import numpy as np, torch
from PIL import Image
from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation
im = Image.open("zer/DSC08650.JPG").convert("RGB").crop((400, 350, 5733, 3350)).resize((1280, 720), Image.LANCZOS)
im.save("zer/a_base.jpg", quality=95)
P = ["a gravel dirt trail", "grass", "rocks and boulders", "sky", "snowy mountain", "a red quadruped robot"]
proc = CLIPSegProcessor.from_pretrained("CIDAS/clipseg-rd64-refined"); m = CLIPSegForImageSegmentation.from_pretrained("CIDAS/clipseg-rd64-refined")
# tile 2 square crops so the 352px model sees more detail
outs = np.zeros((len(P), 720, 1280), np.float32); cnt = np.zeros((720, 1280), np.float32)
win = np.minimum(np.arange(720) + 1, 720 - np.arange(720)).astype(np.float32); win = np.minimum(win / 180, 1)
for x0 in (0, 140, 280, 420, 560):
    wx = win.copy()
    if x0 == 0: wx[:360] = 1
    if x0 == 560: wx[360:] = 1
    tile = im.crop((x0, 0, x0 + 720, 720))
    with torch.no_grad():
        lg = m(**proc(text=P, images=[tile] * len(P), return_tensors="pt", padding=True)).logits
    pr = torch.sigmoid(lg).numpy()
    for k in range(len(P)):
        outs[k, :, x0:x0 + 720] += np.asarray(Image.fromarray(pr[k]).resize((720, 720), Image.BILINEAR)) * wx
    cnt[:, x0:x0 + 720] += wx
np.save("zer/a_prob.npy", outs / cnt)
lab = (outs / cnt).argmax(0)
pal = np.array([[40, 80, 255], [80, 200, 80], [150, 150, 150], [120, 200, 255], [255, 255, 255], [255, 0, 0]], np.uint8)
Image.fromarray(pal[lab]).save("zer/a_lab.png")
