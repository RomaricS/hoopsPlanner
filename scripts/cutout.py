"""Cuts generated art off its plain background and prepares it for the game.

Usage: python3 scripts/cutout.py   (reads assets-src/painted, writes public/painted)
Images on a flat grey/white background get a transparent background (flood fill
from the borders), are trimmed, and resized. Sheets are split into pieces.
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = 'assets-src/painted'
OUT = 'public/painted'
os.makedirs(OUT, exist_ok=True)

def cut(img, tol=26):
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.abs(a - bg).sum(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    cand = (dist < tol * 3) & (sat < 22)
    lab, _ = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge))
    # Soft edge: shrink the object by a pixel and feather.
    obj = ndimage.binary_erosion(~bgmask, iterations=1)
    alpha = Image.fromarray((obj * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = img.convert('RGBA')
    rgba.putalpha(alpha)
    return rgba

def trim(im, pad=4):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))

def fit(im, w):
    if im.width <= w:
        return im
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)

def pieces(im, min_area=4000):
    """Splits a sheet into its separate objects, left-to-right, top-to-bottom."""
    a = np.asarray(im.getchannel('A')) > 40
    a = ndimage.binary_dilation(a, iterations=6)
    lab, n = ndimage.label(a)
    out = []
    for sl in ndimage.find_objects(lab):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if w * h < min_area:
            continue
        out.append((sl[0].start, sl[1].start, im.crop((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))))
    out.sort(key=lambda p: (round(p[0] / 150), p[1]))
    return [trim(p[2]) for p in out]

ROOM_W = 720
for f in sorted(os.listdir(SRC)):
    name, ext = os.path.splitext(f)
    img = Image.open(os.path.join(SRC, f))
    if name.startswith('hero_') or name.startswith('concept_'):
        fit(img.convert('RGB'), 512).save(os.path.join(OUT, name + '.jpg'), quality=88)
        continue
    rgba = trim(cut(img, tol=30 if name == 'worker_sheet' else 26))
    if name in ('props_pots', 'worker_sheet'):
        for i, p in enumerate(pieces(rgba)):
            fit(p, 256).save(os.path.join(OUT, f'{name.replace("_sheet", "").replace("props_", "")}_{i}.png'), optimize=True)
        continue
    w = ROOM_W if '_t' in name else 512
    fit(rgba, w).save(os.path.join(OUT, name + '.png'), optimize=True)
for f in sorted(os.listdir(OUT)):
    im = Image.open(os.path.join(OUT, f))
    print(f'{f:28s} {im.size} {os.path.getsize(os.path.join(OUT, f)) // 1024} KB')

# Seamless grass fill: a rectangle from inside the grass tile's top face, mirrored 2x2.
g = Image.open(os.path.join(OUT, 'tile_grass.png')).convert('RGB')
sx = g.width / 512
crop = g.crop((int(128 * sx), int(84 * sx), int(384 * sx), int(238 * sx)))
w, h = crop.size
fill = Image.new('RGB', (w * 2, h * 2))
fill.paste(crop, (0, 0))
fill.paste(crop.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
fill.paste(crop.transpose(Image.FLIP_TOP_BOTTOM), (0, h))
fill.paste(crop.transpose(Image.ROTATE_180), (w, h))
fill.save(os.path.join(OUT, 'grass_fill.jpg'), quality=90)
print('grass_fill', fill.size)

# WebP copies keep mobile downloads small.
for f in os.listdir(OUT):
    if f.endswith('.png'):
        Image.open(os.path.join(OUT, f)).save(os.path.join(OUT, f[:-4] + '.webp'), 'WEBP', quality=86, method=6)
