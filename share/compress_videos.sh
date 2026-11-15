#!/usr/bin/env bash
# Re-encode the page's videos so they start fast: smaller frames, lower bitrate, faststart, keyframe every ~2 s.
# Reads originals from ~/Claude/roam-project-video-orig (a copy of static/video before compression),
# writes into static/video/. Usage: share/compress_videos.sh   (runs 2 encodes at a time)
set -euo pipefail
cd "$(dirname "$0")/.."
ORIG=$HOME/Claude/roam-project-video-orig
# name  width height fps  quantizer  max-kbps
JOBS=(
  "hero-loop                   1280 720 25 22 2200"
  "exp/hg-grass-geometry       1280 720 30 25 1400"
  "exp/hg-bushes-geometry      1280 720 30 25 1400"
  "exp/hg-mannequin-vint       1280 720 30 25 1400"
  "exp/hg-mannequin-geometry   1280 720 30 25 1400"
  "exp/hg-grass-roam           1280 720 30 25 1400"
  "exp/hg-bushes-roam          1280 720 30 25 1400"
  "exp/hg-mannequin-roam       1280 720 30 25 1400"
  "exp/nav-snow-third          1280 720 30 25 1200"
  "exp/cans-roam               1280 720 30 25 1400"
  "exp/hg-signs-geometry       1280 720 30 25 1300"
  "exp/hg-signs-roam           1280 720 30 25 1300"
  "exp/hg-signs-vint           1280 720 30 25 1300"
  "exp/pallet-sign-on-pallet   1080 720 30 25 1400"
  "exp/pallet-signs-on-grass   1080 720 30 25 1300"
  "exp/pallet-no-sign          1080 720 30 25 1300"
  "exp/nav-snow-roam           1080 720 30 25 1400"
  "exp/nav-rail-roam           1080 720 30 25 1600"
  "exp/nav-route-geometry      1280 720 30 25 1200"
  "exp/nav-route-roam          1280 720 30 25 1200"
  "exp/explore-4x              1280 720  8 25 1200"
  "movie1-how                   960 540 30 25  900"
  "zermatt-flyover             1280 720 30 24 1600"
  "seealpsee-behind             960 540 30 26  800"
  "zermatt-onboard              960 540 20 26  650"
  "seealpsee-onboard            960 540 20 26  650"
  "zermatt-behind               960 540 30 27  550"
)
enc() {
  local name=$1 w=$2 h=$3 fps=$4 q=$5 kbps=$6
  local src="$ORIG/$name.mp4" dst="static/video/$name.mp4" tmp="static/video/$name.tmp.mp4"
  gst-launch-1.0 -q filesrc location="$src" ! qtdemux ! h264parse ! avdec_h264 \
    ! videoconvert ! videoscale ! videorate \
    ! "video/x-raw,width=$w,height=$h,framerate=$fps/1" \
    ! x264enc pass=qual quantizer="$q" bitrate="$kbps" vbv-buf-capacity=2000 speed-preset=slow \
        key-int-max=$((fps * 2)) threads=8 \
    ! video/x-h264,profile=high ! h264parse ! mp4mux faststart=true ! filesink location="$tmp"
  mv "$tmp" "$dst"
  echo "$name $(du -h "$src" | cut -f1) -> $(du -h "$dst" | cut -f1)"
}
export -f enc; export ORIG
printf '%s\n' "${JOBS[@]}" | xargs -P 2 -L 1 bash -c 'enc $0 $1 $2 $3 $4 $5'
echo ALL DONE
