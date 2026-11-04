"""Trim the extra guns in AssetPackV2/Guns to their own pixels and write them to public/assets/guns/<id>.png.
Run: python scripts/build-guns.py   (prints the picture size of each, used in src/game/items.js)"""
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'AssetPackV2', 'Guns')
OUT = os.path.join(ROOT, 'public', 'assets', 'guns')

GUNS = {
    'regularpisto.png': 'sidearm', 'glock-19.png': 'glock', 'm1911.png': 'm1911', 'Magnum.png': 'magnum', 'd-eagle.png': 'deagle',
    'miniUzi.png': 'uzi', 'AK-47.png': 'ak47', 'lever-rifle.png': 'lever', 'SniperRifle.png': 'sniper', 'ShortGun.png': 'sawedoff',
    'shoot-gun.png': 'pump', 'ray-gun.png': 'raygun', 'BlueLaser.png': 'laser', 'fireplasma.png': 'fireplasma', 'HighQualityPlasma.png': 'quantum',
}

for fname, gid in GUNS.items():
    im = Image.open(os.path.join(SRC, fname)).convert('RGBA')
    box = im.getbbox()
    out = im.crop(box)
    out.save(os.path.join(OUT, gid + '.png'))
    print(gid, out.size)
