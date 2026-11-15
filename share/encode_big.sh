#!/usr/bin/env bash
# Re-encode the videos that are over the 15 MB per-file limit of a shared Claude page.
# Output goes to share/site/static/video/... ; the originals in static/ are untouched.
# Usage: share/encode_big.sh   (runs at most 3 encodes at a time)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=share/site

# name  width height fps  kbps  keyint
JOBS=(
  "zermatt-behind      640 360 15  140  30"
  "seealpsee-onboard   640 360 10  250  20"
  "zermatt-onboard     640 360 10  300  20"
  "seealpsee-behind    960 540 30  640  60"
  "exp/nav-rail-roam  1440 960 30 2200  30"
  "exp/pallet-no-sign 1440 960 30 1250  30"
  "exp/explore-4x     1280 720 15 2000  15"
  "exp/nav-route-roam 1280 720 30 1700  30"
  "zermatt-flyover    1280 720 30 2500  60"
  "exp/hg-signs-vint  1280 720 30 1300  30"
  "exp/hg-signs-roam  1280 720 30 1500  30"
)

enc() {
  local name=$1 w=$2 h=$3 fps=$4 kbps=$5 kint=$6
  local src="static/video/$name.mp4" dst="$OUT/static/video/$name.mp4"
  [ -s "$dst" ] && { echo "$name exists, skipped"; return; }
  mkdir -p "$(dirname "$dst")"
  gst-launch-1.0 -q filesrc location="$src" ! qtdemux ! h264parse ! avdec_h264 \
    ! videoconvert ! videoscale ! videorate \
    ! "video/x-raw,width=$w,height=$h,framerate=$fps/1" \
    ! x264enc bitrate="$kbps" speed-preset=slow key-int-max="$kint" threads=8 \
    ! h264parse ! mp4mux faststart=true ! filesink location="$dst"
  echo "$name $(du -h "$dst" | cut -f1)"
}
export -f enc; export OUT

printf '%s\n' "${JOBS[@]}" | xargs -P 3 -L 1 bash -c 'enc $0 $1 $2 $3 $4 $5'
