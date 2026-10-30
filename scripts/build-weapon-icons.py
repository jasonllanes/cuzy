"""Cut the staffs, slingshots and tridents the shop sells out of the V2 weapon icon pack (AssetPackV2/weapons).

The pack's icons sit on a dark framed tile; this keeps only the weapon and writes public/assets/weapons/x_<number>.png.
Needs Pillow. Run: python scripts/build-weapon-icons.py
"""
import os
from collections import deque

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'AssetPackV2', 'weapons', 'Icons_background')
OUT = os.path.join(ROOT, 'public', 'assets', 'weapons')

PICKS = {
    'staffs': [69, 77, 81, 83, 87],
    'slingshots': [141, 142, 143, 147],
    'tridents': [117, 121, 125],
}
FILL = (102, 76, 80)
EDGE = (83, 58, 70)


def cut(im):
    w, h = im.size
    px = im.load()
    clear = set()
    for x in range(w):
        clear.update([(x, 0), (x, h - 1)])
    for y in range(h):
        clear.update([(0, y), (w - 1, y)])  # the outer frame
    # the flat tile behind the weapon: flood in from the inner edge through the two tile colours only
    seen = set()
    todo = deque((x, y) for x in range(1, w - 1) for y in range(1, h - 1) if (x in (1, w - 2) or y in (1, h - 2)) and px[x, y][:3] in (FILL, EDGE))
    while todo:
        x, y = todo.popleft()
        if (x, y) in seen or not (0 < x < w - 1 and 0 < y < h - 1) or px[x, y][:3] not in (FILL, EDGE):
            continue
        seen.add((x, y))
        todo.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    out = im.copy()
    op = out.load()
    for x, y in clear | seen:
        op[x, y] = (0, 0, 0, 0)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for cat, nums in PICKS.items():
        for n in nums:
            im = Image.open(os.path.join(SRC, cat, f'rpg_icons_{n}.png')).convert('RGBA')
            cut(im).save(os.path.join(OUT, f'x_{n}.png'))
    print('icons ->', OUT)


main()
