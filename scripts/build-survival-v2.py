"""Survival, in V2 art: the base (a container shelter instead of the camper RV) and the barricades (barbed wire that joins up),
cut from the Modern Exteriors atlases in public/assets/v2 and written over the sprites Survival loads from public/assets/apoc.
Also updates src/game/apoc.json (the sizes of those sprites).

Needs Pillow. Run: python scripts/build-survival-v2.py   (after scripts/build-v2-assets.py)
"""
import json
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ATLAS = os.path.join(ROOT, 'public', 'assets', 'v2', 'atlas')
APOC = os.path.join(ROOT, 'public', 'assets', 'apoc')
SIZES = os.path.join(ROOT, 'src', 'game', 'apoc.json')

_cache = {}


def sprite(theme, name):
    if theme not in _cache:
        _cache[theme] = (Image.open(os.path.join(ATLAS, theme + '.png')).convert('RGBA'), {n: (x, y, w, h) for n, x, y, w, h in json.load(open(os.path.join(ATLAS, theme + '.json')))})
    atlas, d = _cache[theme]
    x, y, w, h = d[name]
    return atlas.crop((x, y, x + w, y + h))


def trim(im):
    return im.crop(im.getbbox())


def fit(im, w, h, anchor='center'):
    """a w x h image taken from the middle (and the bottom) of the trimmed sprite"""
    im = trim(im)
    x = max(0, (im.width - w) // 2)
    y = max(0, im.height - h)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(im.crop((x, y, x + min(w, im.width), y + min(h, im.height))), (max(0, (w - im.width) // 2), max(0, h - im.height)))
    return out


def terrain(n):
    return sprite('terrain', n)


# The barbed-wire autotile. A wall joins whatever stands N (1), E (2), S (4) and W (8) of it, so one sheet holds a piece for each of the
# 16 combinations (column = that mask), plus a column 16 for a lone upright piece. Every cell is 16x32 with the wire in the bottom 16
# rows (the footprint). Both rows are the same wire, so a wall you place always matches the starting ring (the ring is only tougher). The coils of
# Barbed_Wire_1_* fill their whole 16x16 cell, so neighbouring pieces always run into each other.
def fence_sheet():
    def w(name):
        return sprite('military', 'Barbed_Wire_1_' + name)

    across, upright = w('Top_Middle_Modular'), w('Vertical')
    across2 = w('Bottom_Middle_Modular')
    pieces = {
        0: across, 1: w('Middle_Modular_Left'), 2: w('Bottom_Corner_Left'), 3: w('Bottom_Corner_Left'), 4: w('Top_Corner_Right_Small_1'),
        5: upright, 6: w('Top_Corner_Left'), 7: w('Middle_Modular_Left'), 8: w('Bottom_Corner_Right'), 9: w('Bottom_Corner_Right'),
        10: across, 11: across2, 12: w('Top_Corner_Right'), 13: w('Middle_Modular_Right'), 14: across, 15: upright, 16: upright,
    }
    out = Image.new('RGBA', (17 * 16, 64), (0, 0, 0, 0))
    for row in range(2):
        for mask, im in pieces.items():
            im = im.copy()
            out.alpha_composite(im, (mask * 16, row * 32 + 16))
    return out


def main():
    sizes = json.load(open(SIZES))

    def save(key, im):
        im.save(os.path.join(APOC, key + '.png'))
        sizes[key] = {'w': im.width, 'h': im.height}

    # the base: a shelter built from shipping containers
    save('bus', sprite('props', 'Container_House_1'))

    # barricades: barbed wire that joins up (see fence_sheet)
    fence = fence_sheet()
    fence.save(os.path.join(APOC, 'barbwire.png'))
    sizes['barbwire'] = {'w': fence.width, 'h': fence.height}
    for gone in ('fence', 'wire'):
        sizes.pop(gone, None)  # (earlier names of the sheet, in other looks: a new name keeps browsers from showing a cached old one)
    old_fence = os.path.join(APOC, 'wire.png')
    if os.path.exists(old_fence):
        os.remove(old_fence)
    for key in ('wall_h', 'wall_v', 'rwall_h', 'rwall_v'):
        sizes.pop(key, None)
        old = os.path.join(APOC, key + '.png')
        if os.path.exists(old):
            os.remove(old)
    # the icon in the backpack
    save('icon_wall', sprite('military', 'Barbed_Wire_1_Top_Middle_Modular'))
    json.dump(sizes, open(SIZES, 'w'), indent=1)
    print('ok')


main()
