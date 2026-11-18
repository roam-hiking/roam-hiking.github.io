#!/bin/sh
# Encode the distance-sampled robot-camera frames (tools/build_robotcam.py) for scroll-scrubbing:
# a keyframe every 6 frames so any seek lands fast. usage: tools/encode_robotcam.sh zermatt|seealpsee
set -e
F=${FFMPEG:-$HOME/Claude/agentic-rllab-venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2}
cd "$(dirname "$0")/.."
for kind in cam risk; do
  $F -hide_banner -loglevel error -y -framerate 30 -i "review/robotcam/$1/$kind/%05d.jpg" -vf scale=720:480 \
     -c:v libx264 -preset slow -crf 27 -g 6 -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "static/video/$1-robotcam-$kind.mp4"
done
ls -la static/video/$1-robotcam-*.mp4
