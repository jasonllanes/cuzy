"""Make the stun grenade (blue) and the smoke grenade (grey) from the sticky grenade icon in public/assets/items/grenade.png.
Run: python scripts/build-grenade-icons.py   (needs Pillow)
"""
import os

from PIL import Image

ITEMS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'items')
GREENS = [(64, 90, 38), (98, 132, 56), (150, 186, 88)]
VARIANTS = {
    'grenade_stun': [(38, 64, 150), (66, 120, 222), (140, 190, 255)],
    'grenade_smoke': [(70, 70, 80), (112, 112, 124), (188, 188, 198)],
}

src = Image.open(os.path.join(ITEMS, 'grenade.png')).convert('RGBA')
for name, colors in VARIANTS.items():
    im = src.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if (r, g, b) in GREENS:
                nr, ng, nb = colors[GREENS.index((r, g, b))]
                px[x, y] = (nr, ng, nb, a)
    im.save(os.path.join(ITEMS, f'{name}.png'))
print('ok')
