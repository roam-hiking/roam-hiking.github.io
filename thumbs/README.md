# YouTube thumbnails

- `roam-yt-main.jpg`: Movie 1. Sony DSLR photo DSC08650 (Zermatt, 15 Aug 2024), left part painted with ROAM's risk image.
- `roam-yt-seealpsee.jpg`: Seealpsee film, frame at 2:08 of `AnyMal_Seealpsee_Final2_dated.mp4`.

Rebuild the main one:

1. Copy `DSC08650.JPG` from the SSD (`nature_hiking/pictures/`) into `zer/`.
2. `seg.py` (CLIPSeg, used only to cut out the robot) writes `zer/a_base.jpg` and `zer/a_prob.npy`.
3. `run_roam.py` runs the ROAM release code (`vlm_nav`, SAN) with `zermatt_labels_v2.json`
   in the `roam-noetic-emc` container; setup in `install_san.sh` (lives in `~/.cache/roam-san`). Copy `out_full2.npz` into `zer/`.
4. `make_main_risk.py` composes the thumbnail.

`zermatt_labels.json` is the VLM answer from the Zermatt mission. `_v2` adds mountain, sky and
large_rock_outcrop and raises rocks to 0.95 for the thumbnail.
