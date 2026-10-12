"""Renders villagers: the KayKit mannequin (CC0, rigged) with African skin tones,
modelled clothing, hair and tools, posed with KayKit animations.

Run: blender -b -P blender/characters.py -- out.png
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHARS = os.path.join(ROOT, 'assets-src/models/chars')
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/chars.png'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def mat(name, color, rough=0.8, sheen=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    return m


def cloth(name, a, b, scale=3.0, stripes=True):
    """Woven cloth: two colours in bands, kente/wax-print feel."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    tc = nt.nodes.new('ShaderNodeTexCoord')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = scale
    wave.inputs['Distortion'].default_value = 0.0
    wave2 = nt.nodes.new('ShaderNodeTexChecker')
    wave2.inputs['Scale'].default_value = scale * 1.6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].color = (*a, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (*b, 1)
    nt.links.new(tc.outputs['Object'], wave.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], wave2.inputs['Vector'])
    mixf = nt.nodes.new('ShaderNodeMath')
    mixf.operation = 'MAXIMUM'
    nt.links.new(wave.outputs['Fac'], mixf.inputs[0])
    sc = nt.nodes.new('ShaderNodeMath')
    sc.operation = 'MULTIPLY'
    sc.inputs[1].default_value = 0.5 if stripes else 0.0
    nt.links.new(wave2.outputs['Fac'], sc.inputs[0])
    nt.links.new(sc.outputs['Value'], mixf.inputs[1])
    nt.links.new(mixf.outputs['Value'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return m


# ------------------------------------------------------------------ assets

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


# Animation library: import once, keep the actions, drop the objects.
actions = {}
for lib in ['General', 'Tools', 'CombatMelee', 'MovementBasic']:
    objs = import_glb(os.path.join(CHARS, f'Rig_Medium_{lib}.glb'))
    for o in objs:
        if o.animation_data and o.animation_data.action:
            o.animation_data.action = None
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
for a in bpy.data.actions:
    a.use_fake_user = True
    actions[a.name] = a


def part(obj, bone, arm, smooth=True, subsurf=1):
    """Parents an object to a bone keeping its world placement."""
    if smooth:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth()
    if subsurf:
        m = obj.modifiers.new('sub', 'SUBSURF')
        m.levels = subsurf
        m.render_levels = subsurf
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    obj.matrix_world = mw
    return obj


def add(kind, **kw):
    getattr(bpy.ops.mesh, f'primitive_{kind}_add')(**kw)
    return bpy.context.object


def villager(x, y, rot, skin, outfit):
    objs = import_glb(os.path.join(CHARS, 'Mannequin_Medium.glb'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    stray = [o for o in objs if o.type == 'MESH' and o.parent is None]
    meshes = [o for o in objs if o.type == 'MESH' and o.parent == arm]
    for o in stray:
        bpy.data.objects.remove(o, do_unlink=True)
    root = arm
    # Skin: multiply the mannequin texture (keeps the eyes) by a skin tone.
    sk = bpy.data.materials.new(f'skin{skin}')
    sk.use_nodes = True
    img = next(i for i in bpy.data.images if 'mannequin' in i.name.lower())
    nt = sk.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    mul = nt.nodes.new('ShaderNodeMixRGB')
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Fac'].default_value = 1.0
    mul.inputs['Color2'].default_value = (*srgb(skin), 1)
    nt.links.new(tex.outputs['Color'], mul.inputs['Color1'])
    # The face lives in the lower-left quarter of the texture; elsewhere use flat skin.
    uv = nt.nodes.new('ShaderNodeUVMap')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
    mx = nt.nodes.new('ShaderNodeMath')
    mx.operation = 'MAXIMUM'
    nt.links.new(sep.outputs['X'], mx.inputs[0])
    nt.links.new(sep.outputs['Y'], mx.inputs[1])
    lt = nt.nodes.new('ShaderNodeMath')
    lt.operation = 'LESS_THAN'
    lt.inputs[1].default_value = 0.5
    nt.links.new(mx.outputs['Value'], lt.inputs[0])
    pick = nt.nodes.new('ShaderNodeMixRGB')
    pick.inputs['Color1'].default_value = (*srgb(skin), 1)
    nt.links.new(lt.outputs['Value'], pick.inputs['Fac'])
    nt.links.new(mul.outputs['Color'], pick.inputs['Color2'])
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.55
    nt.links.new(pick.outputs['Color'], bsdf.inputs['Base Color'])
    flat = mat(f'skinflat{skin}', srgb(skin), 0.55)
    for m in meshes:
        m.data.materials.clear()
        m.data.materials.append(sk if 'Head' in m.name else flat)

    bpy.context.view_layer.update()
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()

    def bone_pos(name):
        b = arm.pose.bones[name]
        return arm.matrix_world @ b.head

    def bounds(name):
        o = next(m for m in meshes if name in m.name)
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        return lo, hi

    blo, bhi = bounds('Body')
    hlo, hhi = bounds('Head')
    bw = (bhi.x - blo.x) / 2
    bd = (bhi.y - blo.y) / 2
    hc = (hlo + hhi) / 2
    hr = (hhi.x - hlo.x) / 2
    bh = bhi.z - blo.z

    wrap = cloth(f"wrap{outfit['wrap']}{outfit['wrap2']}", srgb(outfit['wrap']), srgb(outfit['wrap2']))
    # Wrap skirt from the waist to the ankles.
    top = blo.z + bh * 0.42
    bot = 0.16
    o = add('cone', vertices=24, radius1=bw * 1.22, radius2=bw * 1.04, depth=top - bot, location=(0, (blo.y + bhi.y) / 2, (top + bot) / 2), end_fill_type='NOTHING')
    o.scale.y = bd / bw
    o.data.materials.append(wrap)
    part(o, 'hips', arm)
    belt = add('torus', major_radius=bw * 1.05, minor_radius=0.035, location=(0, (blo.y + bhi.y) / 2, top))
    belt.scale.y = bd / bw
    belt.data.materials.append(mat(f"belt{outfit['wrap2']}", srgb(outfit['wrap2'])))
    part(belt, 'hips', arm)
    if outfit.get('top'):
        tm = cloth(f"top{outfit['top']}{outfit['wrap']}", srgb(outfit['top']), srgb(outfit['wrap']), 4)
        o = add('cylinder', vertices=24, radius=bw * 1.04, depth=bh * 0.5, location=(0, (blo.y + bhi.y) / 2, blo.z + bh * 0.7))
        o.scale.y = bd / bw * 1.02
        o.data.materials.append(tm)
        part(o, 'chest', arm)
    else:
        sash = add('torus', major_radius=bw * 1.0, minor_radius=0.05, location=(0, 0, blo.z + bh * 0.68), rotation=(0, math.radians(35), 0))
        sash.scale.y = bd / bw * 1.1
        sash.data.materials.append(wrap)
        part(sash, 'chest', arm)

    hair = mat('hair', srgb('#1c120c'), 0.95)
    hx = (hhi.x - hlo.x) / 2
    hy = (hhi.y - hlo.y) / 2
    hzz = (hhi.z - hlo.z) / 2

    def cap(material, z_from, scale=1.05, keep_front_above=None, name='cap'):
        """Ellipsoid fitted to the head, cut below z_from (local, -1..1); the front can be cut higher."""
        import bmesh
        o = add('uv_sphere', segments=32, ring_count=16, radius=1, location=hc)
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        kill = [v for v in bm.verts if v.co.z < z_from or (keep_front_above is not None and v.co.y < -0.35 and v.co.z < keep_front_above)]
        bmesh.ops.delete(bm, geom=kill, context='VERTS')
        bm.to_mesh(me)
        bm.free()
        o.scale = (hx * scale, hy * scale, hzz * scale)
        o.data.materials.append(material)
        sol = o.modifiers.new('solid', 'SOLIDIFY')
        sol.thickness = 0.05
        return o

    if outfit['hair'] == 'headwrap':
        hw = cloth(f"hw{outfit['wrap2']}{outfit['wrap']}", srgb(outfit['wrap2']), srgb(outfit['wrap']), 2.2, False)
        o = cap(hw, -0.15, 1.2, keep_front_above=0.4)
        o.location.z += hzz * 0.12
        part(o, 'head', arm)
        k = add('uv_sphere', segments=16, ring_count=8, radius=hx * 0.45, location=(hc.x, hc.y + hy * 0.2, hhi.z + hzz * 0.12))
        k.scale = (1.4, 1.0, 0.75)
        k.data.materials.append(hw)
        part(k, 'head', arm)
    elif outfit['hair'] == 'short':
        part(cap(hair, 0.0, 1.17, keep_front_above=0.5), 'head', arm)
    elif outfit['hair'] == 'plume':
        part(cap(mat('helm', srgb('#2a1c14'), 0.7), 0.05, 1.17, keep_front_above=0.55), 'head', arm)
        for i, c in enumerate(['#f4f1e8', '#c23b22', '#f4f1e8']):
            f = add('cone', vertices=8, radius1=0.07, depth=0.6, location=(hc.x + (i - 1) * 0.14, hc.y + hy * 0.4, hhi.z + 0.22), rotation=(0.25, (i - 1) * -0.35, 0))
            f.data.materials.append(mat(f'feather{c}', srgb(c)))
            part(f, 'head', arm)

    # Tools in the right hand.
    hand = bone_pos('hand.r')
    wood = mat('toolwood', srgb('#6b4220'))
    metal = mat('toolmetal', srgb('#a8adb4'), 0.35)
    metal.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 0.8
    tool = outfit.get('tool')
    if tool == 'axe':
        h = add('cylinder', vertices=10, radius=0.03, depth=0.8, location=(hand.x, hand.y, hand.z + 0.25))
        h.data.materials.append(wood)
        part(h, 'hand.r', arm, subsurf=0)
        b = add('cube', size=1, location=(hand.x, hand.y + 0.1, hand.z + 0.6))
        b.scale = (0.05, 0.22, 0.16)
        b.data.materials.append(metal)
        part(b, 'hand.r', arm, subsurf=0)
    elif tool == 'spear':
        h = add('cylinder', vertices=10, radius=0.03, depth=2.2, location=(hand.x, hand.y, hand.z + 0.55))
        h.data.materials.append(wood)
        part(h, 'hand.r', arm, subsurf=0)
        t = add('cone', vertices=8, radius1=0.08, depth=0.32, location=(hand.x, hand.y, hand.z + 1.8))
        t.scale.y = 0.4
        t.data.materials.append(metal)
        part(t, 'hand.r', arm, subsurf=0)
    elif tool == 'hammer':
        h = add('cylinder', vertices=10, radius=0.03, depth=0.6, location=(hand.x, hand.y, hand.z + 0.18))
        h.data.materials.append(wood)
        part(h, 'hand.r', arm, subsurf=0)
        b = add('cube', size=1, location=(hand.x, hand.y, hand.z + 0.48))
        b.scale = (0.12, 0.24, 0.12)
        b.data.materials.append(metal)
        part(b, 'hand.r', arm, subsurf=0)
    if outfit.get('shield'):
        handl = bone_pos('hand.l')
        s = add('uv_sphere', segments=20, ring_count=12, radius=0.4, location=(handl.x + 0.12, handl.y + 0.1, handl.z))
        s.scale = (0.12, 0.65, 1.0)
        s.data.materials.append(cloth('cowhide', srgb('#efe6d2'), srgb('#3a2414'), 2, False))
        part(s, 'lowerarm.l', arm)
    if outfit.get('basket'):
        handl = bone_pos('hand.l')
        b = add('cylinder', vertices=20, radius=0.22, depth=0.22, location=(handl.x + 0.1, handl.y + 0.2, handl.z))
        b.data.materials.append(cloth('weave', srgb('#c09a5a'), srgb('#9a7438'), 12, False))
        part(b, 'hand.l', arm, subsurf=0)

    arm.data.pose_position = 'POSE'
    arm.animation_data_create()
    arm.animation_data.action = actions[outfit['anim']]
    root.location = (x, y, 0)
    root.rotation_euler.z = rot
    root.scale = (0.42, 0.42, 0.42)
    return arm, outfit.get('frame', 10)


ROT = math.radians(float(os.environ.get('ROT', '-135')))
people = [
    ('#8d5524', dict(wrap='#c2733a', wrap2='#2d5fa6', top='#e8b83a', hair='headwrap', anim='Idle_A', basket=True)),
    ('#6e4226', dict(wrap='#2e6b4f', wrap2='#f0c33c', hair='short', tool='axe', anim='Chopping', frame=14)),
    ('#5a3a22', dict(wrap='#e9dcc0', wrap2='#3a2414', hair='plume', tool='spear', shield=True, anim='Melee_2H_Idle')),
    ('#a0673a', dict(wrap='#8c2f39', wrap2='#e9dcc0', top='#8c2f39', hair='headwrap', anim='Walking_A', frame=8)),
    ('#7a4a2a', dict(wrap='#5b4a8a', wrap2='#f0c33c', hair='short', tool='hammer', anim='Hammering', frame=12)),
]
rigs = []
for i, (skin, o) in enumerate(people):
    rigs.append(villager(-1.3 + i * 0.65, 1.3 - i * 0.65, ROT, skin, o))
scene.frame_set(10)
for arm, f in rigs:
    act = arm.animation_data.action
    arm.animation_data.action = act
for arm, f in rigs:
    # Each rig evaluates its own action at its own frame via an offset strip.
    act = arm.animation_data.action
    arm.animation_data.action = None
    tr = arm.animation_data.nla_tracks.new()
    st = tr.strips.new(act.name, 1, act)
    st.frame_start = 10 - f + 1
scene.frame_set(10)

# Ground disc to catch shadows.
g = add('cylinder', vertices=48, radius=3.4, depth=0.1, location=(0, 0, -0.05))
g.data.materials.append(mat('ground', srgb('#8a6a48'), 1.0))

# ------------------------------------------------------------------ camera, lights

cam = bpy.data.cameras.new('cam')
cam.type = 'ORTHO'
cam.ortho_scale = 4.6
co = bpy.data.objects.new('cam', cam)
scene.collection.objects.link(co)
dist = 20
elev = math.radians(35.264)
co.location = (-dist * math.cos(elev) * math.sqrt(0.5), -dist * math.cos(elev) * math.sqrt(0.5), dist * math.sin(elev) + 0.45)
co.rotation_euler = (math.radians(90) - elev, 0, math.radians(-45))
scene.camera = co

sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 3.4
sun.angle = math.radians(8)
sun.color = (1, 0.92, 0.8)
so = bpy.data.objects.new('sun', sun)
so.rotation_euler = (math.radians(50), 0, math.radians(-20))
scene.collection.objects.link(so)
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.82, 0.95, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
scene.world = world

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 800
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Punchy'
scene.render.use_freestyle = True
scene.render.line_thickness = 1.2
fs = scene.view_layers[0].freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('ink')
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('ink')
ls.linestyle.color = (0.12, 0.08, 0.05)
ls.select_crease = False
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
