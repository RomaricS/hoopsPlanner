"""Builds the forge cutaway room procedurally and renders it at the fixed game angle.

Run: blender -b -P blender/forge.py -- out.png
"""
import math
import random
import sys

import bpy
from mathutils import Vector

random.seed(7)
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/forge.png'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ------------------------------------------------------------------ materials

def mat(name, color, rough=0.85, emission=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def noisy(name, color, scale=6.0, amount=0.25, rough=0.95):
    m = mat(name, color, rough)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = 6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    c = color
    ramp.color_ramp.elements[0].color = (c[0] * (1 - amount), c[1] * (1 - amount), c[2] * (1 - amount), 1)
    ramp.color_ramp.elements[1].color = (min(1, c[0] * (1 + amount)), min(1, c[1] * (1 + amount)), min(1, c[2] * (1 + amount)), 1)
    nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    nt.links.new(n.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


BRICKS = [noisy(f'brick{i}', srgb(c), 9, 0.22) for i, c in enumerate(['#b08458', '#a67a4e', '#bb9064', '#9e7448', '#b38a5c'])]
BAND = [noisy('bandRed', srgb('#9a3a22'), 9, 0.15), noisy('bandCream', srgb('#e2cfa6'), 9, 0.1), noisy('bandDark', srgb('#3a2618'), 9, 0.1)]
MORTAR = noisy('mortar', srgb('#7e5e3e'), 12, 0.2)
FLOOR = noisy('floor', srgb('#8a6a48'), 3, 0.3, 1.0)
DIRT = noisy('dirt', srgb('#5e4630'), 4, 0.3, 1.0)
STONE = [mat(f'stone{i}', srgb(c)) for i, c in enumerate(['#8d8a83', '#9a968e', '#7d7a74'])]
WOOD = noisy('wood', srgb('#7a5434'), 20, 0.25)
DARKWOOD = mat('darkwood', srgb('#4e3420'))
IRON = mat('iron', srgb('#3c3f44'), 0.45, metal=0.8)
STEEL = mat('steel', srgb('#9aa0a8'), 0.35, metal=0.9)
COAL = mat('coal', srgb('#1a1716'), 0.9)
EMBER = mat('ember', srgb('#ff6a1a'), 0.6, emission=srgb('#ff5a10'), strength=6)
ROPE = mat('rope', srgb('#c9a46a'))


def box(name, size, loc, material, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 2
    o.data.materials.append(material)
    return o


def cyl(name, r, h, loc, material, verts=16, rot=(0, 0, 0), r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=h, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


# ------------------------------------------------------------------ room shell
# Floor is 4 x 4 units centred on the origin; x right-back, y left-back.
S = 4.0
H_BACK = 1.5
H_FRONT = 0.45
T = 0.28

box('slab', (S + 0.3, S + 0.3, 0.3), (0, 0, -0.15), DIRT, 0.04)
box('floor', (S, S, 0.04), (0, 0, 0.02), FLOOR)


def brick_wall(x0, y0, x1, y1, h, skip=None):
    """Wall of individual bricks from (x0,y0) to (x1,y1)."""
    length = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    bh = 0.18
    rows = max(1, round(h / bh))
    for r in range(rows):
        bl = 0.42
        offset = (r % 2) * bl / 2
        pos = -offset
        while pos < length:
            a = max(0, pos)
            b = min(length, pos + bl)
            pos += bl
            if b - a < 0.06:
                continue
            mid = (a + b) / 2
            if skip and skip[0] < mid < skip[1] and r * bh < 2:
                continue
            cx = x0 + math.cos(ang) * mid
            cy = y0 + math.sin(ang) * mid
            z = 0.04 + r * bh + bh / 2
            jitter = random.uniform(-0.012, 0.012)
            m = random.choice(BRICKS)
            if h > 1 and r in (5, 6):
                m = BAND[(int(pos / bl) + r) % 3] if r == 5 else BAND[2]
            o = box('brick', ((b - a) - 0.025, T + jitter, bh - 0.022 + random.uniform(-0.01, 0.01)), (cx, cy, z + random.uniform(-0.006, 0.006)), m, 0.035, (0, 0, ang))
            o.rotation_euler.z += random.uniform(-0.01, 0.01)
    # Mortar core so gaps look filled.
    spans = [(0, length)] if not skip else [(0, skip[0]), (skip[1], length)]
    for a, b in spans:
        mid = (a + b) / 2
        box('mortar', (b - a, T * 0.8, rows * bh), (x0 + math.cos(ang) * mid, y0 + math.sin(ang) * mid, 0.04 + rows * bh / 2), MORTAR, rot=(0, 0, ang))


h = S / 2
# Back walls (tall): along the far x edge and far y edge.
brick_wall(-h, h, h, h, H_BACK)        # back-left (left of camera)
brick_wall(h, -h, h, h, H_BACK)        # back-right
# Front walls (low), doorway in the front-left one.
brick_wall(-h, -h, -h, h, H_FRONT, skip=(1.5, 2.5))
brick_wall(-h, -h, h, -h, H_FRONT)

# ------------------------------------------------------------------ furnace

fx, fy = 0.6, 1.0
for r in range(5):
    for i in range(10):
        a = i / 10 * math.tau
        ring = 0.62 - r * 0.02
        o = box('fstone', (0.28, 0.2, 0.17), (fx + math.cos(a) * ring, fy + math.sin(a) * ring, 0.1 + r * 0.17), random.choice(STONE), 0.03, (0, 0, a + math.pi / 2))
cyl('coals', 0.5, 0.06, (fx, fy, 0.92), COAL, 20)
for i in range(14):
    a = random.uniform(0, math.tau)
    d = random.uniform(0, 0.38)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.04, 0.08), location=(fx + math.cos(a) * d, fy + math.sin(a) * d, 0.97))
    bpy.context.object.data.materials.append(EMBER if i % 2 else COAL)
# Arched openings: dark recesses facing the camera.
for k in (-0.22, 0.22):
    o = cyl('arch', 0.14, 0.3, (fx - 0.52, fy + k - 0.4, 0.28), COAL, 12, rot=(0, math.pi / 2, math.radians(45)))
glow = bpy.data.lights.new('fireglow', 'POINT')
glow.energy = 120
glow.color = (1, 0.5, 0.2)
glow.shadow_soft_size = 0.4
lo = bpy.data.objects.new('fireglow', glow)
lo.location = (fx, fy, 1.3)
scene.collection.objects.link(lo)

# ------------------------------------------------------------------ anvil on a stump

ax, ay = -0.3, -0.2
cyl('stump', 0.32, 0.5, (ax, ay, 0.29), WOOD, 18, r2=0.3)
cyl('ring', 0.3, 0.02, (ax, ay, 0.54), mat('endgrain', srgb('#b98a5a')), 18)
box('anvil_base', (0.36, 0.22, 0.18), (ax, ay, 0.63), IRON, 0.03)
box('anvil_waist', (0.24, 0.14, 0.12), (ax, ay, 0.77), IRON, 0.02)
box('anvil_top', (0.6, 0.24, 0.12), (ax, ay, 0.89), IRON, 0.03)
cyl('horn', 0.11, 0.32, (ax - 0.44, ay, 0.89), IRON, 12, rot=(0, math.pi / 2, 0), r2=0.01)

# ------------------------------------------------------------------ workbench and tools

bx, by = -0.9, 1.3
box('benchtop', (1.5, 0.6, 0.08), (bx, by, 0.72), WOOD, 0.02)
for dx in (-0.65, 0.65):
    for dy in (-0.22, 0.22):
        box('leg', (0.09, 0.09, 0.68), (bx + dx, by + dy, 0.36), DARKWOOD, 0.01)
for i in range(6):
    o = box('bar', (random.uniform(0.25, 0.45), 0.05, 0.04), (bx + random.uniform(-0.55, 0.55), by + random.uniform(-0.2, 0.2), 0.79), STEEL, 0.01, (0, 0, random.uniform(-0.6, 0.6)))

# Tool rack on the back-left wall.
box('rack', (1.6, 0.06, 0.08), (-0.6, h - 0.2, 1.25), DARKWOOD, 0.01)
for i in range(6):
    x = -1.25 + i * 0.26
    if i % 2:
        cyl('handle', 0.025, 0.45, (x, h - 0.24, 1.0), WOOD, 8)
        box('head', (0.16, 0.07, 0.07), (x, h - 0.24, 1.24), IRON, 0.01)
    else:
        for s in (-1, 1):
            o = cyl('tong', 0.015, 0.5, (x + s * 0.03, h - 0.24, 1.0), IRON, 6, rot=(0, s * 0.08, 0))

# Bucket and scattered iron bars.
cyl('bucket', 0.2, 0.36, (0.9, -1.0, 0.22), WOOD, 18, r2=0.24)
cyl('water', 0.21, 0.02, (0.9, -1.0, 0.38), mat('bwater', srgb('#2f5f7a'), 0.1), 18)
for i in range(7):
    box('ironbar', (0.5, 0.06, 0.05), (-1.2 + random.uniform(-0.2, 0.2), -1.1 + i * 0.08, 0.07), IRON, 0.01, (0, 0, random.uniform(-0.3, 0.3)))

# Clay pots and baskets in the corners.
POT = noisy('pot', srgb('#a4532c'), 8, 0.15, 0.7)
BASKET = noisy('basket', srgb('#c09a5a'), 40, 0.25)
for (px, py, r) in [(1.55, -1.4, 0.2), (1.6, -1.0, 0.15), (1.45, 1.55, 0.22), (1.05, 1.62, 0.16)]:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(px, py, r * 1.05))
    o = bpy.context.object
    o.scale.z = 1.15
    o.data.materials.append(POT)
    bpy.ops.object.shade_smooth()
    cyl('neck', r * 0.5, r * 0.3, (px, py, r * 2.2), POT, 14, r2=r * 0.6)
for (px, py) in [(-1.55, 0.4), (-1.55, -0.1)]:
    cyl('basket', 0.24, 0.3, (px, py, 0.19), BASKET, 18, r2=0.28)
    for i in range(5):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.07, location=(px + random.uniform(-0.12, 0.12), py + random.uniform(-0.12, 0.12), 0.36))
        bpy.context.object.data.materials.append(COAL)
# Charcoal and scraps scattered on the floor.
for i in range(40):
    a = random.uniform(0, math.tau)
    d = random.uniform(0.7, 1.6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.02, 0.05), location=(fx + math.cos(a) * d * 0.7, fy + math.sin(a) * d * 0.7 - 0.6, 0.05))
    bpy.context.object.data.materials.append(COAL)

# ------------------------------------------------------------------ camera, light, render

cam = bpy.data.cameras.new('cam')
cam.type = 'ORTHO'
cam.ortho_scale = 7.4
co = bpy.data.objects.new('cam', cam)
scene.collection.objects.link(co)
# True isometric: 45 deg around, 35.264 deg down, looking from the front corner (-x, -y).
dist = 20
elev = math.radians(35.264)
co.location = (-dist * math.cos(elev) * math.sqrt(0.5), -dist * math.cos(elev) * math.sqrt(0.5), dist * math.sin(elev) + 0.6)
co.rotation_euler = (math.radians(90) - elev, 0, math.radians(-45))
scene.camera = co

sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 3.2
sun.angle = math.radians(8)
sun.color = (1, 0.9, 0.75)
so = bpy.data.objects.new('sun', sun)
so.rotation_euler = (math.radians(50), 0, math.radians(-20))
scene.collection.objects.link(so)

world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.82, 0.95, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
scene.world = world

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Punchy'
# Ink outlines for an illustrated look.
scene.render.use_freestyle = True
scene.render.line_thickness = 1.3
fs = scene.view_layers[0].freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('ink')
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('ink')
ls.linestyle.color = (0.12, 0.08, 0.05)
ls.select_by_visibility = True
ls.select_crease = True
ls.select_border = True
ls.select_silhouette = True

scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
