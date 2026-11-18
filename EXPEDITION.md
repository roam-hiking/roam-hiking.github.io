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

- Seealpsee: whole loop; 9 moments (all featured); robot camera rebuilt without manual-driving footage.
- Zermatt (2026-11-18): **whole route, km 0-10.45.** All seven raw bags are extracted to `review/bagcache/`
  (`review/run_bags.sh`; the SSD must sit on a USB 3 port: on USB 2 it reads 40 MB/s, ~40 min per bag, on USB 3
  ~500 MB/s, ~3 min). 35 moments, 16 of them **featured** (full stop, orbiting camera); the other 19 are
  **pass-bys** (card + floating screen while the robot walks past, camera leans in). Robot camera covers the whole
  route except manual-driving stretches (biggest hole km 5.97-7.0).
- Featured vs pass-by: `tools/vlm_picks.json` -> `featured.<hike>` (answer timestamps). A hike without a list has
  every pick featured. `publish` writes `f: 1/0` per moment. Candidates always keep published picks (the 30 m
  thinning used to drop one whenever a recording was added).
- Journey: each hike opens on its whole route over the whole map (route lit red and widened, numbered badges on the
  moment beams = the card's "N of M"; red badge = featured stop, dark = pass-by), then flies down to the start while
  the red line draws back. Seealpsee's overview comes right after the haze. Badges declutter on screen (featured and
  lower numbers win) and also show in Map mode. `overview()` in expedition.js; journey units `U.si` = Seealpsee overview.
- Still to do: record a Play preview and re-cut the teaser with the new second half.

## Known weaknesses / ideas

- Zermatt ground still softer than Seealpsee up close (corridor imagery z17 ~0.8 m/px); idea: stream z18 tiles in a
  patch around the robot.
- Fixed 2026-11-18: stops framed the robot at the very bottom of the screen (aim point 26 m up) and sometimes faced a
  slope a few metres away; the camera now orbits on the uphill side and aims 40% of the way from robot to screen.
  The walked-route glow speckled near the camera (now fades out within ~400 m) and the route tube hid the robot's
  body close up (now fades for a few metres around the robot). The robot has a soft contact shadow.
- Transitions between hikes are a white haze fade; could be a real fly-over.
- The robot is a scaled-up GLB with a simple trot (contact shadow only close up).
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
