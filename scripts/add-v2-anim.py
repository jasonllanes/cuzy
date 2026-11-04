"""Copy a handful of animated sheets from Modern Exteriors (Animated_16x16) into public/assets/v2/anim, for the world's scenery.
Run: python scripts/add-v2-anim.py   (the frame sizes live in src/game/v2world.js, ANIMS)"""
import os
import shutil

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'AssetPackV2', 'Modern_Exteriors_16x16', 'Animated_16x16', 'Animated_sheets_16x16')
OUT = os.path.join(ROOT, 'public', 'assets', 'v2', 'anim')

SHEETS = {
    'fountain1': 'Garden_Fountain_1_16x16.png',
    'fountain3': 'Garden_Fountain_3_16x16.png',
    'fountain5': 'Garden_Fountain_5_16x16.png',
    'fountain8': 'Fountain_16x16.png',
    'flag': 'School_Flag_1_16x16.png',
    'cookpot': 'Campfire_2_16x16.png',
}

os.makedirs(OUT, exist_ok=True)
for aid, fname in SHEETS.items():
    shutil.copyfile(os.path.join(SRC, fname), os.path.join(OUT, aid + '.png'))
print('animated sheets ->', OUT)
