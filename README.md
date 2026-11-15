# ROAM project page

Static project page for *Common-sense reasoning from vision-language models guides legged robots on kilometer-scale hikes* (Science Robotics, aee1549). One `index.html` with no build step, plus media in `static/`.

**Status: embargoed draft.** Don't publish it until the paper is out.

## Preview locally

```bash
python3 serve.py 8790
```

Then open http://localhost:8790. Use `serve.py` rather than `python -m http.server`: it supports byte-range requests, which video seeking (and the map–video sync) needs. GitHub Pages supports them too.

## Leave comments on the draft

The local preview adds a yellow **Comment** button (bottom right). Tap it, tap the part of the page you mean, write a note and save. A numbered pin stays on that part, and the "N open" button lists every comment (show, mark done, delete).

Comments are saved in `review-comments.json` next to `serve.py` (not tracked by git). The button comes from `review/review.js`, which `serve.py` adds to the page on the fly. `index.html` does not load it, so the published site has no comment button.

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
| Gallery | Original Fig. 2 source images, found through the links in `fig2_v0.ai` |
| Figures | Manuscript figures. They were CMYK (Japan Color 2001) and are converted to sRGB using the embedded profile. |
| Hero loop, Seealpsee poster | `AnyMal_Seealpsee_Final2.mp4` (recorded 25 June 2024) |
| Fig. 4 course lab | `videos/Main/{construction-sign,geometry-short,vint-short}.mp4`, cut per trap. ViNT on traps 01–02 (not in Fig. 4A; ViNT ignores the offset global path) is cut from its full raw run: bushes `videos/construction-signs/C0335.MP4` 530–600 s at 7×, grass `C0336.MP4` 20–100 s at 8×. |
| Fig. 5A sign lab | `rosbags/2024-arche-experiments/palette_*` and `explosive_cans`: onboard camera plus risk/steppable/preferred renders as a synced 2×2 mosaic. VLM values come from the logged responses. |
| Navigation training clip (Isaac) | `roam-project-video-orig/src/isaac-training-2024-11-13_22.19.44.mp4`, 594–649 s (one fixed camera view in the stairwell room), cropped `left=320 top=78 bottom=78` to hide the simulator panel, played at 12× (the simulator recording runs slower than real time) → `static/video/exp/nav-training-12x.mp4` (1280×720, 5.6 s, 1 MB). |
| Fig. 5B route lab | Arche C0272 (ROAM) and C0281 (geometry-only) 8× timelapses, `gpt_rail` and snow onboard mosaics. The page plays only part of each mosaic (`range` in `ROUTES`): railroad from 9.5 s (skips the robot standing and turning at the start), snow up to 13.2 s (stops at the top of the passage). The top-down map next to the mixed route is the Fig. 5B map, rendered from `aee1549_ai_sources/rev3/fig5-arche.pdf` → `static/img/arche-route-map.jpg`. |
| Fig. 5C lab | `videos/construction-signs/C0333.MP4` (third-person, 20 Sep 2024), 0–192 s at 4×; steps a–d start at 2.5 / 9 / 33.5 / 42.5 s |
| Movie 1 highlight (scroll play) | `submission/initial-submission/Main.mp4`, 30.5–92.5 s (the method part), no audio → `static/video/movie1-how.mp4` (960×540, 10 MB) and `movie1-how-360.mp4` for phones (640×360, 3 MB, `bitrate=380 key-int-max=15`). The page downloads the right one whole as soon as it opens, pins it and sets the video time from the scroll position, with a title per part (`PARTS` in the script). It is encoded with a keyframe every 6 frames (x264enc `key-int-max=6 bitrate=1300`) so seeking is smooth; keep that if you re-encode. The full movie opens from the button once `SITE.youtube.movie1` is set. |
| Top slider grid (camera ↔ risk) | `good_image_N` pairs from the NEWEST processing of each run (older runs have misaligned overlays): hall/campus Dropbox `experiments/indoor-urban-nature/mission2` #1/#3 (Jan 2025), test site `rosbags/2024-arche-experiments/gpt_long_navigation/mission2` #0 (Feb 2025), lake/huts Dropbox `experiments/seealpsee/mission-labels2` #4/#7 (Dec 2024), forest `construction-signs/GPT-full` #12, Matterhorn/railway `zermatt/mission-2` #11/#32. Left image = whichever camera file the overlay was built from (raw for the newer runs, `_closest` for the older ones; pick by edge match). Files `*-v3.jpg`, 720×480. |
| Section 01 core demo ("What the VLM sees") | Logged `good_image_<N>` sets from the missions, resized to 1200×800: Seealpsee `rosbags/seealpsee/mission-new` #10 (cows) and #15 (huts); Zermatt `rosbags/zermatt/mission-2` #32 (railway), #34 (chalet and Matterhorn), #38 (forest trail). Camera = `..._hdr_camera_front-image_raw-compressed-image.png`, map = `..._overlay_risk.png`. Quotes are shortened from each `..._responses_raw.txt` and the label values are copied from its JSON. Snowy passage: `nav-snow-roam` at 10 s (preferred map). No sign scenes here; those are in section 04. |
| Section 02 (think / ground / walk) | Fig. 1 source frame `rosbags/zermatt/mission-nice-1/good_image_1_*` (15 Aug 2024) with its logged VLM response; renders from the Fig. 1 Illustrator links; the elevation-map image is a Movie 1 frame (1:14). On a phone the six steps show as one row (`.pipe`) built from the same data as the desktop cards. |
| Hike highlight cards (section 03, above the maps) | Loops cut from the behind-the-robot timelapses, 640×360. Zermatt: `static/video/zermatt-behind.mp4` 505–580 s (last stretch of the railway, past the station, down the gravel road into the forest), played at 2× → `static/video/zermatt-descent.mp4` (38 s, 1.8 MB, `bitrate=380 key-int-max=30`). Seealpsee: `seealpsee-behind.mp4` 18–28 s → `seealpsee-highlight.mp4` (1 MB). Both cards always show; "See the route" scrolls to that hike's map. Both maps show one under the other (no tabs); each loads when it comes near the screen. The numbers are the ones from the paper (10.1 km, 1220 m descent, about 30% steepest; 2.38 km loop). |
| Route explorer | Robot GNSS tracks (`zermatt/mission-2`, `seealpsee/mission-new`), elevation profile from swisstopo swissALTI3D. 3D map: MapLibre GL 5.6 with Esri World Imagery (default), swisstopo aerial/topo, AWS terrain tiles |
| Zermatt flyover | `Zermatt_videos/output.mp4` (Google Earth) |
| Photo pins | Zermatt: 8 pins that show the robot walking during the mission (1 geotagged team photo from `Zermatt_videos/Pictures`, 7 video frames). Photos of the robot standing or posed, or without the robot, are left out. |
| Onboard camera (Zermatt) | Front camera plus risk inset from the three mission logs (`rosbags/zermatt/*.h5`), 10× speed. The inset uses the same method as the processed `semantic_risk.mp4` renders, checked against the Seealpsee renders: raw `lmm_nav_sem` channel 0 (risk), coolwarm on an absolute 0–1 scale, blended 42% camera and 58% overlay. GPS-synced; covers km 0–0.6 and 2.35–4.1. |
| Onboard camera (Seealpsee) | Your processed renders (`rosbags/seealpsee/seealpsee{1,2,4}/hdr_camera_front.mp4` and `semantic_risk.mp4`): camera frame k equals camera message k, and risk frame 3k matches it. Timed from the `.h5` logs, so it's GPS-synced for the whole loop. |
| Behind-the-robot videos | `submission/initial-submission/{zermatt,seealpsee}-full.mp4`. Zermatt is synced by landmark anchors (lake, huts, construction path, railway), so positions are approximate; image matching against the onboard video was tried and rejected there (too little overlapping footage, cuts in the edit). Seealpsee is image-matched: DINOv2 features of the upper frame, order-preserving alignment to the GPS-timed onboard video, then monotone smoothing (moved positions by ~180 m median versus the old Fig. 3B anchors). Playback starts at 2.6 s (Zermatt) and 3 s (Seealpsee) to skip the robot standing before the start. |
| Seealpsee pins | Fig. 3B panels (a)–(i), placed by fitting the figure's route line onto the GPS track (≈30 m), so positions are approximate. |

Self-hosted video is limited to short clips. Long videos go on YouTube.
