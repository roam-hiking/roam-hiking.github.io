# ROAM project page

Static project page for *Common-sense reasoning from vision-language models guides legged robots on kilometer-scale hikes* (Science Robotics, aee1549). One `index.html` with no build step, plus media in `static/`.

**Status: embargoed draft.** Don't publish it until the paper is out.

## Preview locally

```bash
python3 serve.py 8790
```

Then open http://localhost:8790. Use `serve.py` rather than `python -m http.server`: it supports byte-range requests, which video seeking (and the map–video sync) needs. GitHub Pages supports them too.

## Launch checklist

All fill-in values live in one `SITE` block near the end of `index.html`:

```js
const SITE = {
  youtube: { movie1: "", seealpsee: "", zermattOnboard: "", zermattBehind: "", seealpseeBehind: "", seealpseeOnboard: "" },
  links: { paper: "", supplementary: "" },
  published: false
};
```

1. Upload Movie 1 and "A day at Seealpsee" to YouTube, then paste each video ID into `SITE.youtube`. Until then the players show a "on YouTube soon" poster.
   The four map-synced videos (`zermatt-behind`, `zermatt-onboard`, `seealpsee-behind`, `seealpsee-onboard` in `static/video/`) can also go on YouTube. Set the matching `SITE.youtube` key and the map sync drives the YouTube player instead; then you can delete the local file.
2. Paste the paper and supplementary URLs into `SITE.links`. The buttons switch on by themselves.
3. Set `published: true` to hide the embargo bar, and delete `<meta name="robots" content="noindex, nofollow">` in `<head>`.
4. Fill in volume, issue, pages and DOI in the BibTeX block (search for `TODO`).
5. Create the GitHub repo, push, and turn on Pages (Settings → Pages → deploy from branch `main`, root folder).

Every file is under GitHub's 100 MB limit, and the site is about 210 MB.

## Where the content comes from

| Page part | Source |
|---|---|
| Figures | Manuscript figures. They were CMYK (Japan Color 2001) and are converted to sRGB using the embedded profile. |
| Hero loop, Seealpsee poster | `AnyMal_Seealpsee_Final2.mp4` (recorded 25 June 2024) |
| Fig. 4 course lab | `videos/Main/{construction-sign,geometry-short,vint-short}.mp4`, cut per trap |
| Fig. 5A sign lab | `rosbags/2024-arche-experiments/palette_*` and `explosive_cans`: onboard camera plus risk/steppable/preferred renders as a synced 2×2 mosaic. VLM values come from the logged responses. |
| Fig. 5B route lab | Arche C0272 (ROAM) and C0281 (geometry-only) 8× timelapses, `gpt_rail` and snow onboard mosaics |
| Fig. 5C | Panels cropped from Fig. 5C |
| Fig. 6 chart | Table 1 |
| Route explorer | Robot GNSS tracks (`zermatt/mission-2`, `seealpsee/mission-new`), elevations from swisstopo swissALTI3D, imagery © swisstopo |
| Zermatt flyover | `Zermatt_videos/output.mp4` (Google Earth) |
| Photo pins | 12 geotagged team photos from `Zermatt_videos/Pictures`, placed by their EXIF GPS |
| Onboard camera (Zermatt) | Front camera plus risk inset from the three mission logs (`rosbags/zermatt/*.h5`), 10× speed. The inset is recolored to coolwarm from the logged per-frame-normalized risk strip, matching `semantic-videos/*/semantic_risk.mp4` (those don't match these logs frame-for-frame). GPS-synced; covers km 0–0.6 and 2.35–4.1. |
| Onboard camera (Seealpsee) | Your processed renders (`rosbags/seealpsee/seealpsee{1,2,4}/hdr_camera_front.mp4` and `semantic_risk.mp4`): camera frame k equals camera message k, and risk frame 3k matches it. Timed from the `.h5` logs, so it's GPS-synced for the whole loop. |
| Behind-the-robot videos | `submission/initial-submission/{zermatt,seealpsee}-full.mp4`. Synced by landmark anchors (lake, huts, construction path, railway; Fig. 3B boulder, cows, dirt road), so positions are approximate. |
| Seealpsee pins | Fig. 3B panels (a)–(i), placed by fitting the figure's route line onto the GPS track (≈30 m), so positions are approximate. |

Self-hosted video is limited to short clips. Long videos go on YouTube.
