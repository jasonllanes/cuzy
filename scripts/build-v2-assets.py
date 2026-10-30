"""Packs the Modern Exteriors pack (AssetPackV2/, kept out of git) into the sprite atlases the V2 Training Room loads.

    python scripts/build-v2-assets.py

Writes public/assets/v2/:
  index.json            the themes (name, how many sprites, atlas files) and the ground tiles worth using
  atlas/<theme>.png     every single sprite of one theme packed into one image
  atlas/<theme>.json    where each sprite is: [name, x, y, w, h]
  chars/*.png           the ready-made character sheets (Scout, Postman, Skeleton, Swimmers), copied as they are
Credit (required by the pack's license): LimeZu, https://limezu.itch.io/modernexteriors
"""
import json
import os
import re
import shutil
import statistics
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
PACK = os.path.join(ROOT, 'AssetPackV2', 'Modern_Exteriors_16x16')
SORTER = os.path.join(PACK, 'ME_Theme_Sorter_16x16')
OUT = os.path.join(ROOT, 'public', 'assets', 'v2')
ATLAS_W = 1536  # widest an atlas gets
PAD = 1

THEMES = {
    '1_Terrains_and_Fences': ('terrain', 'Terrains and fences'),
    '2_City_Terrains': ('city', 'City terrains'),
    '3_City_Props': ('props', 'City props'),
    '4_Generic_Building': ('buildings', 'Generic buildings (modular)'),
    '5_Floor_Modular_Building': ('floors', 'Floor modular buildings'),
    '6_Garage_Sales': ('garage', 'Garage sales'),
    '7_Villas': ('villas', 'Villas'),
    '8_Worksite': ('worksite', 'Worksite'),
    '9_Shopping_Center_and_Markets': ('shops', 'Shopping centre and markets'),
    '10_Vehicles': ('vehicles', 'Vehicles'),
    '11_Camping': ('camping', 'Camping'),
    '12_Hotel_and_Hospital': ('hotel', 'Hotel and hospital'),
    '13_School': ('school', 'School'),
    '14_Swimming_Pool': ('pool', 'Swimming pool'),
    '15_Police_Station': ('police', 'Police station'),
    '16_Office': ('office', 'Office'),
    '17_Garden': ('garden', 'Garden'),
    '18_Fire_Station': ('fire', 'Fire station'),
    '19_Graveyard': ('graveyard', 'Graveyard'),
    '20_Subway_and_Train_Station': ('subway', 'Subway and train station'),
    '21_Beach': ('beach', 'Beach'),
    '22_Post_Office': ('post', 'Post office'),
    '23_MIlitary_Base': ('military', 'Military base'),
    '24_Additional_Houses': ('houses', 'Additional houses'),
}

CHARS = {
    'Modern_Exteriors_Characters_Scout_16x16_%d.png': ('scout%d.png', range(1, 7)),
    'Modern_Exteriors_Characters_Postman_16x16_%d.png': ('postman%d.png', range(1, 4)),
}
CHAR_ONE = {
    'Modern_Exteriors_Characters_Skeleton_1_16x16.png': 'skeleton.png',
    'Modern_Exteriors_Characters_Swimmers_16x16.png': 'swimmers.png',
}


# a few animated sheets (a row of equal frames): file, frames, frame width, frame height
ANIM = {
    'campfire': ('Campfire_16x16.png', 6, 16, 32),
    'streetlamp': ('Street_Lamp_16x16.png', 4, 80, 80),
}


def short(name):
    """ME_Singles_City_Props_16x16_Bench_1.png -> Bench_1"""
    n = re.sub(r'\.png$', '', name)
    n = re.sub(r'^ME_Singles_[A-Za-z_]*?16x16_', '', n)
    n = re.sub(r'^\d+_[A-Za-z_]*?16x16_', '', n)
    return n


def pack(images):
    """Shelf packing, tallest first. images: [(name, Image)] -> (atlas, [[name, x, y, w, h]])"""
    order = sorted(images, key=lambda it: (-it[1].height, -it[1].width, it[0]))
    x = y = shelf = 0
    placed = []
    for name, im in order:
        w, h = im.size
        if x + w > ATLAS_W:
            x = 0
            y += shelf + PAD
            shelf = 0
        placed.append((name, im, x, y))
        x += w + PAD
        shelf = max(shelf, h)
    height = y + shelf
    atlas = Image.new('RGBA', (ATLAS_W, max(1, height)), (0, 0, 0, 0))
    out = []
    for name, im, px, py in placed:
        atlas.paste(im, (px, py))
        out.append([name, px, py, im.width, im.height])
    # trim the empty right side
    used = max((p[1] + p[3] for p in out), default=1)
    atlas = atlas.crop((0, 0, used, atlas.height))
    return atlas, out


def plainest(items, count, keep=lambda mean: True):
    """The fully opaque 16x16 tiles with the least colour variation (and a colour that passes `keep`): the ones to fill the ground with"""
    scored = []
    for name, im in items:
        if im.size != (16, 16):
            continue
        px = list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())
        if any(p[3] < 255 for p in px):
            continue
        mean = [sum(p[i] for p in px) / len(px) for i in range(3)]
        if not keep(mean):
            continue
        lum = [0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2] for p in px]
        scored.append((statistics.pvariance(lum), name))
    scored.sort()
    return [n for _, n in scored[:count]]


def main():
    if not os.path.isdir(SORTER):
        sys.exit('AssetPackV2 is not there: expected ' + SORTER)
    os.makedirs(os.path.join(OUT, 'atlas'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'chars'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'anim'), exist_ok=True)
    themes = []
    ground = {}
    total_sprites = 0
    tiles16 = []  # every fully opaque 16x16 sprite: (theme, name, image), for picking ground tiles
    for folder in sorted(os.listdir(SORTER)):
        key = re.sub(r'_Singles_16x16$', '', folder)
        if key not in THEMES:
            continue
        tid, label = THEMES[key]
        images = []
        seen = set()
        for dp, _, files in os.walk(os.path.join(SORTER, folder)):
            for f in sorted(files):
                if not f.lower().endswith('.png'):
                    continue
                try:
                    im = Image.open(os.path.join(dp, f)).convert('RGBA')
                except Exception:
                    continue
                name = short(f)
                while name in seen:
                    name += '_'
                seen.add(name)
                images.append((name, im))
        for n, im in images:
            if im.size == (16, 16) and im.getchannel('A').getextrema()[0] == 255:
                tiles16.append((tid, n, im))
        atlas, data = pack(images)
        atlas.save(os.path.join(OUT, 'atlas', tid + '.png'), optimize=True)
        with open(os.path.join(OUT, 'atlas', tid + '.json'), 'w') as fh:
            json.dump(data, fh, separators=(',', ':'))
        themes.append({'id': tid, 'name': label, 'folder': key, 'count': len(data), 'w': atlas.width, 'h': atlas.height})
        total_sprites += len(data)
        print(f'{tid:10s} {len(data):5d} sprites  atlas {atlas.width}x{atlas.height}  {os.path.getsize(os.path.join(OUT, "atlas", tid + ".png")) // 1024} KB')
    # ground tiles: the plainest fully opaque 16x16 tiles of each colour family, as 'theme/name'
    def pick(count, keep, themes_only=None, prefix=None):
        cands = [(t, n, im) for t, n, im in tiles16 if (not themes_only or t in themes_only) and (not prefix or n.startswith(prefix))]
        chosen = plainest([(n, im) for _, n, im in cands], count * 6, keep)
        by_name = {n: t for t, n, _ in cands}
        return [f'{by_name[n]}/{n}' for n in chosen[:count]]

    green = lambda m: m[1] > m[0] * 1.25 and m[1] > m[2] * 1.25
    ground['grass'] = pick(4, green, ['terrain'], 'Grass_')
    ground['asphalt'] = pick(3, lambda m: sum(m) / 3 < 110, ['city'], 'Asphalt')
    ground['sidewalk'] = pick(3, lambda m: sum(m) / 3 > 150, ['city'], 'Sidewalk')
    ground['water'] = pick(3, lambda m: m[2] > m[0] * 1.4 and m[2] >= m[1], ['terrain'], 'Deep_Water')
    ground['dirt'] = ['terrain/Grass_1_21']  # (the plain orange-brown "grass" tile is bare earth; sand has no plain tile in the pack and is painted by the game)
    # the character sheets
    cdir = os.path.join(PACK, 'Character_Generator_Addons_16x16', 'Characters_16x16')
    chars = []
    for pattern, (dest, rng) in CHARS.items():
        for n in rng:
            shutil.copyfile(os.path.join(cdir, pattern % n), os.path.join(OUT, 'chars', dest % n))
            chars.append(dest % n)
    for src, dest in CHAR_ONE.items():
        shutil.copyfile(os.path.join(cdir, src), os.path.join(OUT, 'chars', dest))
        chars.append(dest)
    anim = {}
    adir = os.path.join(PACK, 'Animated_16x16', 'Animated_sheets_16x16')
    for aid, (fname, frames, fw, fh_) in ANIM.items():
        shutil.copyfile(os.path.join(adir, fname), os.path.join(OUT, 'anim', aid + '.png'))
        anim[aid] = {'file': 'anim/' + aid + '.png', 'frames': frames, 'fw': fw, 'fh': fh_}
    with open(os.path.join(OUT, 'index.json'), 'w') as fh:
        json.dump({'credit': 'Modern Exteriors by LimeZu (https://limezu.itch.io/modernexteriors)', 'tile': 16, 'themes': themes, 'ground': ground, 'chars': chars, 'anim': anim, 'sprites': total_sprites}, fh, indent=1)
    print('total', total_sprites, 'sprites;', 'ground', ground)


if __name__ == '__main__':
    main()
