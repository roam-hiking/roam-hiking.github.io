# 3D Expedition: handoff (2026-11-18)

Context for whoever continues the ROAM **3D Expedition** page (`expedition.html`). Read this, then `README.md`
(sources table) before changing anything. The project is an **embargoed** Science Robotics project page
(aee1549): keep the `noindex` meta and the draft bar; never push or publish without Takahiro's explicit OK.

## What it is

- `expedition.html` + `static/js/expedition.js` (three.js r128 from cdnjs, GLTFLoader + OrbitControls from
  jsDelivr three@0.128.0). A **separate page** on purpose: it is heavy. The main page (`index.html`) keeps the
  lighter MapLibre route explorers (`static/js/explorer.js`) and a teaser card linking here.
- Scroll drives a journey: intro orbit over Zermatt -> Zermatt hike -> climb into haze -> Seealpsee loop -> outro.
  Play button flies it (speed 1/2x-4x). Map button = just the 3D route, free orbit (Esc returns).
- Per hike: real terrain + swisstopo imagery, ANYmal C model trotting along the RTK-GPS route (scaled up when the
  camera is far), glowing route (walked red, ahead flowing white; each tube ring carries its route distance in
  metres, attribute `sd`), a beam + floating camera/risk screen at each curated VLM moment, a chase camera that
  orbits the robot at each moment, a "What the robot saw" card (aligned camera/risk images, avoid/keep headline,
  VLM sentence, label bars, behind-the-robot footage from that point), a robot's-camera panel scrubbed to the
  robot's position (camera/risk toggle; fades out where there is no footage), telemetry and an elevation profile.

## Data and tools (all re-runnable)

| What | Tool | Output |
|---|---|---|
| Terrain heights + imagery | `tools/bake_terrain.py <hike>` (AWS Terrain Tiles, swisstopo SWISSIMAGE; corridor imagery z17/z18 in two halves) | `static/terrain/<hike>/` |
| VLM moments | `tools/build_vlm_moments.py cand <hike>` -> review contact sheets in `review/vlmcand/<hike>/` -> pick by eye -> `tools/vlm_picks.json` (answer timestamps) -> `publish <hike>` | `static/data/<hike>-vlm.json`, `static/img/vlm/<hike>/` |
| Robot camera (1 frame per 4 m / 2 m of route) | `tools/build_robotcam.py <hike>` then `tools/encode_robotcam.sh <hike>` (keyframe every 6 frames) | `static/data/<hike>-robotcam.json`, `static/video/<hike>-robotcam-{cam,risk}.mp4` |
| Raw-bag segments | `tools/bag_to_h5.py <bag> <out.h5>` (rosbags Reader; only 5 topics deserialized) | `review/bagcache/*.h5` (same layout as the full recordings; the two tools above pick them up automatically) |
| Teaser clip on the main page | `review/xp_rec.py` (Play-mode screen recording), cut by hand | `static/video/expedition-teaser.mp4` |

Sources on the SSD (`/run/media/takahiro/takahiroSSD/nature_hiking/rosbags/`): full h5 recordings (camera,
`lmm_nav_sem` risk layer, VLM answers, RTK GPS, `user_command_relay/twist_input`) in `zermatt/`, `zermatt/map_o3d/`,
`seealpsee/`. `command_hdf5/` copies hold only camera + `user_twist` (= twist_input), no GPS/VLM/risk.

## Hard rules (Takahiro has corrected each of these)

1. **Pair camera and risk by HEADER stamp** (`.../time`), never by arrival (`msg_t`): the risk layer arrives
   ~0.42 s after the frame it was computed from. Before showing anything, check frames with people: the red outline
   must sit exactly on the person.
2. **No interventions.** Joystick commands less than 120 s apart form one manual-driving stretch; nothing within
   60 s of a stretch is used (moments and robot-camera frames). A single 30 s window was not enough (it let a
   Seealpsee moment inside a 411 s manual stretch through).
3. **Only nice, catchy moments with a correct-looking risk image**, picked by eye from the contact sheets.
4. He wants it **impressive, cinematic, game-like**, not "ordinary"; transitions continuous, "not like going
   through cards". Show real data (h5 / good_images), both cameras.
5. Commit as Takahiro (mktk1117) with **no Claude trailer**; never push without his OK.

## State right now

- Seealpsee: whole loop; 9 moments; robot camera rebuilt without manual-driving footage.
- **Zermatt: moments and robot camera only up to km 4.1.** The rest exists only as raw bags. Coverage by recording:
  14 Aug 12:51 km 0-0.59 (h5), 13:15 ~km 0.6-1.0 (bag), 13:47 km 0.97-2.31 (h5, `map_o3d/`), 15 Aug 09:47
  km 2.35-3.16 (h5), 10:06 km 3.20-4.09 (h5), 11:06 ~km 4.1-5.6 (bag), 11:59 km 5.59-5.95 (bag, **done**),
  16 Aug 08:59 / 09:42 / 16:22 / 16:50 (bags, presumably km 6-10.1).
- Extraction runs as the systemd user service **`roam-bags`** (`review/run_bags.sh`, one bag at a time, ~40 min
  each, writes `review/bagcache/<bag>.h5` + `.done`; re-run skips finished bags; a reboot at 02:05 killed the first
  attempt). Check: `systemctl --user status roam-bags`, `journalctl --user -u roam-bags`, `ls review/bagcache`.
- When the bags are in: `build_vlm_moments.py cand zermatt` -> review sheets -> add second-half picks to
  `tools/vlm_picks.json` -> `publish zermatt`; `build_robotcam.py zermatt` + `encode_robotcam.sh zermatt`; check
  alignment on people; record a preview; re-cut the teaser.

## Known weaknesses / ideas

- Zermatt ground still softer than Seealpsee up close (corridor imagery z17 ~0.8 m/px).
- Transitions between hikes are a white haze fade; could be a real fly-over.
- The robot is a scaled-up GLB with a simple trot; no shadows on the terrain.
- Phone layout works but is cramped; weaker GPUs untested (60 fps on an RTX 3090, also with CPU 4x slower).
- The teaser clip shows the embargo bar: re-cut after publication.

## Running and checking

- Local preview with the review "Comment" button: `python3 serve.py 8792` -> http://localhost:8792/expedition.html
  (running now as user service `roam-serve-8792`; `roam-serve-tailnet` serves the same on the Tailscale address,
  port 8795).
- Headless checks on the real GPU (Playwright + system Chrome, `--use-gl=angle --use-angle=gl-egl
  --ignore-gpu-blocklist`; cap with `systemd-run --user --scope -p MemoryMax=5G`): `review/xp3d.py` (screenshots at
  journey units), `review/xp_rec.py` (Play recording), `review/rcchk.py` (robot-camera scrub + speed),
  `review/mapchk.py` (Map mode), `review/xp3d_phone.py` (phone).
