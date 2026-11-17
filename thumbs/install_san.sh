set -e
cd /s
python3 -m pip --version
python3 -m pip -q install --target /s/site fvcore iopath pycocotools "timm==0.9.10" "open_clip_torch==2.16.0" ftfy regex tabulate shapely opencv-python-headless ruamel.yaml omegaconf hydra-core black==21.4b2 2>&1 | grep -v "WARNING" | tail -3
export PYTHONPATH=/s/site:/s/detectron2:/s/SAN:/roam/vlm_nav
cd /s/detectron2 && MAX_JOBS=4 FORCE_CUDA=0 python3 setup.py -q build_ext --inplace 2>&1 | tail -3
python3 -c "import detectron2, san, vlm_nav; from detectron2 import _C; print('ok')"
