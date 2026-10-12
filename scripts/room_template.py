"""Draws blank isometric room shells for image-to-image generation.

Every room generated from these keeps the same camera angle, footprint and
wall height, so they tile together in the game. True isometric angle (30 deg).
Usage: python3 scripts/room_template.py
"""
import math
from PIL import Image, ImageDraw

W, H = 1536, 1024
BG = (214, 214, 214)
ANG = math.radians(30)

def make(name, cells, wall_h, front_h, gate=True):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    size = 760 * cells / 1.0 if cells == 1 else 980  # footprint edge length in px
    if cells == 1:
        size = 640
    hx = math.cos(ANG) * size  # half-width of the floor diamond
    hy = math.sin(ANG) * size
    cx, cy = W / 2, H / 2 + 120
    top = (cx, cy - hy)
    right = (cx + hx, cy)
    bottom = (cx, cy + hy)
    left = (cx - hx, cy)
    t = 26  # wall thickness
    floor = (196, 170, 132)
    wall_in = (222, 200, 166)
    wall_top = (176, 148, 110)
    wall_side = (150, 122, 88)
    line = (60, 45, 30)
    # Slab under the floor.
    slab = 34
    d.polygon([left, bottom, (bottom[0], bottom[1] + slab), (left[0], left[1] + slab)], fill=wall_side, outline=line)
    d.polygon([bottom, right, (right[0], right[1] + slab), (bottom[0], bottom[1] + slab)], fill=(130, 104, 74), outline=line)
    d.polygon([top, right, bottom, left], fill=floor, outline=line)
    up = lambda p, h: (p[0], p[1] - h)
    # Back-left wall (left -> top) and back-right wall (top -> right), inner faces.
    d.polygon([left, top, up(top, wall_h), up(left, wall_h)], fill=wall_in, outline=line)
    d.polygon([top, right, up(right, wall_h), up(top, wall_h)], fill=(208, 186, 152), outline=line)
    # Wall tops.
    off = lambda p, dx, dy: (p[0] + dx, p[1] + dy)
    d.polygon([up(left, wall_h), up(top, wall_h), off(up(top, wall_h), 0, -t * 0.6), off(up(left, wall_h), -t * 0.9, -t * 0.1)], fill=wall_top, outline=line)
    d.polygon([up(top, wall_h), up(right, wall_h), off(up(right, wall_h), t * 0.9, -t * 0.1), off(up(top, wall_h), 0, -t * 0.6)], fill=wall_top, outline=line)

    def low_wall(a, b, h):
        d.polygon([a, b, up(b, h), up(a, h)], fill=wall_side, outline=line)
        d.polygon([up(a, h), up(b, h), off(up(b, h), 0, -t * 0.5), off(up(a, h), 0, -t * 0.5)], fill=wall_top, outline=line)

    lerp = lambda a, b, k: (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)
    # Front-left low wall (left -> bottom), front-right low wall (bottom -> right) with a gate.
    if gate:
        low_wall(left, lerp(left, bottom, 0.4), front_h)
        low_wall(lerp(left, bottom, 0.6), bottom, front_h)
    else:
        low_wall(left, bottom, front_h)
    low_wall(bottom, right, front_h)
    im.save(f'assets-src/templates/{name}.png')
    return im

make('room_template', 1, 190, 60)
