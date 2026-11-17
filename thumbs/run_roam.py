"""Run ROAM's SAN segmentation + label->value conversion on one image with the real Zermatt VLM label table."""
import json, sys, numpy as np, torch
from PIL import Image
from vlm_nav.vlm_seg.semantic_label_processor import SemanticLabelProcessor, SegmentationParameters
from vlm_nav.vlm_seg.prompt_generator import create_prompt_generator_from_yaml
labels = json.load(open("/s/zermatt_labels_v2.json"))["label_estimation"]
defaults = create_prompt_generator_from_yaml("/roam/vlm_nav/config/prompts.yaml", "nature_hiking").get_default_values()
print("defaults", defaults)
proc = SemanticLabelProcessor(SegmentationParameters(model_weight_path="/s/w/san_vit_b_16.pth"))
img = Image.open(sys.argv[1]).convert("RGB")
for tag, size in (("full2", img.size),):
    layers, names, dbg = proc.process(img.resize(size, Image.BICUBIC), labels, defaults, output_debug_info=True)
    out = {n: layers[i].float().cpu().numpy() for i, n in enumerate(names)}
    out["argmax"] = dbg["normalized"].argmax(0).cpu().numpy() if dbg["normalized"].dim() == 3 else np.zeros(1)
    np.savez(f"/s/out_{tag}.npz", vocab=np.array(dbg["vocab"]), **out)
    print(tag, names, {n: (float(v.min()), float(v.max())) for n, v in out.items() if n != "argmax"}, dbg["vocab"])
