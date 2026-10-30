"""Pack the Tiny RPG enemy characters (AssetPackV2/Enemies) into one sheet per character for the game.

Each public/assets/tiny/<slug>.png is a grid of 100x100 frames, one animation per row:
  0 idle   1 walk   2 attack 1   3 attack 2   4 attack 3   5 hurt   6 death   7 special (block / summon / heal)
src/game/tiny-manifest.json says how many frames each row has and where the feet are.
The spells themselves are the separate fx_*.png strips, drawn by the game where they land.

Needs Pillow. Run: python scripts/build-tiny-assets.py
"""
import json
import os
import re
import shutil

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PACK = os.path.join(ROOT, 'AssetPackV2', 'Enemies', 'Tiny RPG Character Asset Pack 01 v2.0 -Full 22 Characters')
CHARS = os.path.join(PACK, 'Characters(100x100 split)')
OUT = os.path.join(ROOT, 'public', 'assets', 'tiny')

# row name -> file name patterns to try, in order (the part after "<Name>_")
ROWS = [
    ('idle', ['Idle', 'Flying']),
    ('walk', ['Walk', 'Walk01', 'Flying']),
    ('atk1', ['Attack01', 'Attack']),
    ('atk2', ['Attack02']),
    ('atk3', ['Attack03', 'Attack3']),
    ('hurt', ['Hurt']),
    ('death', ['Death', 'DEATH']),
    ('special', ['Block', 'Summon', 'Heal']),
]


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for name in sorted(os.listdir(CHARS)):
        d = os.path.join(CHARS, name, name)
        if not os.path.isdir(d):
            continue
        strips = {}
        for row, options in ROWS:
            for opt in options:
                f = os.path.join(d, f'{name}_{opt}.png')
                if os.path.exists(f):
                    strips[row] = Image.open(f).convert('RGBA')
                    break
        cols = max(im.width // 100 for im in strips.values())
        sheet = Image.new('RGBA', (cols * 100, len(ROWS) * 100), (0, 0, 0, 0))
        info = {}
        for i, (row, _) in enumerate(ROWS):
            im = strips.get(row)
            if im is None:
                continue
            sheet.alpha_composite(im, (0, i * 100))
            info[row] = [i, im.width // 100]
        idle = strips['idle'].crop((0, 0, 100, 100))
        bb = idle.getbbox()
        info['foot'] = bb[3]
        info['cx'] = (bb[0] + bb[2]) // 2
        info['h'] = bb[3] - bb[1]
        info['w'] = bb[2] - bb[0]
        sheet.save(os.path.join(OUT, f'{slug(name)}.png'))
        manifest[slug(name)] = info
    # the spell effects (frames centred on the target, the ground at y=57)
    fx = {}
    for key, name in [('wizard1', 'Wizard_Attack01_Effect'), ('wizard2', 'Wizard_Attack02_Effect'), ('necro_attack', 'Necromancer_Attack02_Effect'),
                      ('necro_summon', 'Necromancer_Sumon_Effect'), ('priest_attack', 'Priest_Attack_effect'), ('priest_heal', 'Priest_Heal_effect')]:
        im = Image.open(os.path.join(PACK, 'Magic(Projectile)', name + '.png')).convert('RGBA')
        im.save(os.path.join(OUT, f'fx_{key}.png'))
        fx[key] = im.width // 100
    data = {'chars': manifest, 'fx': fx}
    with open(os.path.join(ROOT, 'src', 'game', 'tiny-manifest.json'), 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    # the arrows that archers and soldiers fire
    for n in (1, 2, 3):
        shutil.copy(os.path.join(PACK, 'Arrow(Projectile)', f'Arrow0{n}(32x32).png'), os.path.join(OUT, f'arrow{n}.png'))
    print(len(manifest), 'characters ->', OUT)


main()
