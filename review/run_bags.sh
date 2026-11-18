#!/bin/bash
# Extract the Zermatt segments that exist only as raw bags, one at a time (tools/bag_to_h5.py). Skips bags already done.
cd "$(dirname "$0")/.."
for b in 2024-08-15-11-06-44 2024-08-14-13-15-40 2024-08-16-08-59-51 2024-08-16-09-42-21 2024-08-16-16-22-45 2024-08-16-16-50-22; do
  out=review/bagcache/$b.h5
  [ -f "$out.done" ] && continue
  echo "$(date +%H:%M) start $b"
  if uv run -q --with rosbags --with h5py --with numpy --with pillow python tools/bag_to_h5.py \
       /run/media/takahiro/takahiroSSD/nature_hiking/rosbags/zermatt/zermatt-mission/$b-merged.bag "$out" 2>&1 | grep -v " messages,"; then
    [ "${PIPESTATUS[0]}" = 0 ] && touch "$out.done"
  fi
  echo "$(date +%H:%M) end $b"
done
