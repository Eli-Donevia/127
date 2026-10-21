# roastery / hero: a kraft bag of roasted beans with a tin-tie top on a dark walnut bar, beans spilled in front (a
# rigid-body drop, so they pile and touch like real ones), a stoneware cup of black coffee steaming behind, lit by one
# bare filament bulb. Accent: a low amber LED strip under the back shelf, far out of focus.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, bmesh, mathutils, time
T0 = time.time()
from mathutils import Vector, noise

W, H = 1200, 1500  # the design's 'bag' slot
E = os.environ.get
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '128')), exposure=float(E('EXPO', '0')))
C.world_color(sc, (0.0015, 0.0012, 0.001))
rng = random.Random(21)

# ---------- bar top: Poly Haven dark_wood, lacquered ----------
wood = C.texture('dark_wood', '2k')
bar_m = C.pbr('bar_walnut', wood, scale=1.0, color_mult=(0.4, 0.38, 0.36), hue_sat=(0.5, 0.6, 0.75), rough_mult=0.6,
              rough_add=0.08, bump=0.4, coat=0.35, coat_rough=0.12)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.3, -0.025))
bar = bpy.context.object; bar.scale = (2.4, 1.6, 0.05); bpy.ops.object.transform_apply(scale=True)
bv = bar.modifiers.new('bev', 'BEVEL'); bv.width = 0.006; bv.segments = 4
C.uv_box(bar, 0.6)
bar.data.materials.append(bar_m)

# ---------- the bag: stand-up kraft pouch, rolled top, tin tie ----------
def kraft():
    """Unbleached kraft: tan-brown with a slow mottle, fine vertical fibres and darker fibre flecks, fully matte."""
    m = bpy.data.materials.new('kraft'); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, 7)  # fibres run vertically
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    fib = N.new('ShaderNodeTexNoise'); fib.inputs['Scale'].default_value = 900; fib.inputs['Detail'].default_value = 6
    L.new(mp.outputs['Vector'], fib.inputs['Vector'])
    mot = N.new('ShaderNodeTexNoise'); mot.inputs['Scale'].default_value = 22; mot.inputs['Detail'].default_value = 5
    L.new(tc.outputs['Object'], mot.inputs['Vector'])
    fl = N.new('ShaderNodeTexVoronoi'); fl.inputs['Scale'].default_value = 650; L.new(mp.outputs['Vector'], fl.inputs['Vector'])
    flm = N.new('ShaderNodeMapRange'); flm.inputs['From Min'].default_value = 0.0; flm.inputs['From Max'].default_value = 0.09
    flm.inputs['To Min'].default_value = 1.0; flm.inputs['To Max'].default_value = 0.0; L.new(fl.outputs['Distance'], flm.inputs['Value'])
    mix = N.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'; mix.inputs[1].default_value = 0.35
    L.new(fib.outputs['Fac'], mix.inputs[0]); L.new(mot.outputs['Fac'], mix.inputs[2])
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].position = 0.45; e[0].color = (0.2, 0.135, 0.075, 1)
    e[1].position = 0.85; e[1].color = (0.33, 0.235, 0.14, 1)
    L.new(mix.outputs[0], ramp.inputs['Fac'])
    dk = N.new('ShaderNodeMix'); dk.data_type = 'RGBA'
    a_, b_ = [x for x in dk.inputs if x.type == 'RGBA'][:2]
    L.new(ramp.outputs['Color'], a_); b_.default_value = (0.09, 0.055, 0.03, 1)
    fm = N.new('ShaderNodeMath'); fm.operation = 'MULTIPLY'; fm.inputs[1].default_value = 0.7; L.new(flm.outputs['Result'], fm.inputs[0])
    L.new(fm.outputs[0], dk.inputs[0])
    L.new([x for x in dk.outputs if x.type == 'RGBA'][0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    b.inputs['Specular IOR Level'].default_value = 0.3
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.0003
    L.new(fib.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

BAG_X, BAG_Y = float(E('BAGX', '0.07')), 0.06
BH = 0.205
def bag_mesh():
    nu, nv = 160, 110
    me = bpy.data.meshes.new('bag'); bm = bmesh.new()
    grid = []
    for j in range(nv + 1):
        v = j / nv
        # side-gusset kraft bag: flat bottom block, pillowed front and back, sides folded in along a V, flattened above
        # the fill line where front meets back under the rolled top
        a = 0.066 + 0.002 * math.sin(math.pi * v)
        vf = 0.74
        u = min(1.0, max(0.0, (v - 0.3) / 0.7)); u = u * u * (3 - 2 * u)
        bdep = 0.0035 + 0.0405 * (1 - u) ** 0.8
        pinch = 0.55 * bdep * min(1.0, v * 12)
        row = []
        for i in range(nu):
            t = 2 * math.pi * i / nu
            c, s = math.cos(t), math.sin(t)
            x = a * math.copysign(abs(c) ** (2 / 8), c)
            y = bdep * math.copysign(abs(s) ** (2 / 8), s)
            if abs(x) > a - bdep:  # the side gusset folds inwards
                w = (abs(x) - (a - bdep)) / max(bdep, 1e-5)
                x = math.copysign(abs(x) - pinch * (1 - abs(y) / max(bdep, 1e-5)) * w * w, x)
            y *= 1 + 0.16 * (1 - min(1, (x / a) ** 2)) * min(1.0, v * 6)
            z = v * BH
            p = Vector((x, y, z))
            k = (0.0035 + 0.004 * (1 - v) ** 6 + 0.004 * max(0, v - vf) / (1 - vf)) * float(E('CREASE', '0.35'))
            q = Vector((x * 26.0, y * 26.0, z * 9.0))
            d = noise.fractal(q, 0.9, 2.0, 4) * k * 0.8                      # soft dents
            d += (1 - abs(noise.noise(q * 1.6 + Vector((3.1, 0, 0))))) ** 6 * k * 0.9   # crease ridges
            d -= (1 - abs(noise.noise(q * 2.3 + Vector((0, 7.7, 0))))) ** 8 * k * 0.6   # and valleys
            nrm = Vector((x / max(a, 1e-4) ** 2, y / max(bdep, 1e-4) ** 2, 0)).normalized()
            row.append(bm.verts.new(p + nrm * d))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((grid[j][i], grid[j][(i + 1) % nu], grid[j + 1][(i + 1) % nu], grid[j + 1][i]))
    bot = bm.faces.new([grid[0][i] for i in range(nu)][::-1])
    top = bm.faces.new([grid[nv][i] for i in range(nu)])
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('bag', me); sc.collection.objects.link(o)
    o.location = (BAG_X, BAG_Y, 0.0)
    o.rotation_euler = (0, 0, math.radians(float(E('BAGROT', '-28'))))
    C.smooth(o)
    o.data.materials.append(kraft())
    return o

bag = bag_mesh()
kr = bag.data.materials[0]
# rolled top: two folds of the flattened top, then the tin tie across
for k, (z, th) in enumerate(((BH - 0.004, 0.012), (BH - 0.016, 0.011))):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.006 - 0.004 * k, z))
    f = bpy.context.object; f.scale = (0.136 + 0.002 * k, th, 0.022); bpy.ops.object.transform_apply(scale=True)
    bv = f.modifiers.new('bev', 'BEVEL'); bv.width = 0.0012; bv.segments = 2   # a folded paper edge is crisp
    f.parent = bag; f.data.materials.append(kr)
tin = C.principled('tin', color=(0.42, 0.41, 0.4), rough=0.45, metal=1.0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.0135, BH - 0.01))
t = bpy.context.object; t.scale = (0.15, 0.0015, 0.008); bpy.ops.object.transform_apply(scale=True)
bv = t.modifiers.new('bev', 'BEVEL'); bv.width = 0.0006; bv.segments = 2
t.parent = bag; t.data.materials.append(tin)
for s in (-1, 1):  # tie ends folded back
    bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 0.076, -0.006, BH - 0.01))
    e = bpy.context.object; e.scale = (0.003, 0.016, 0.008); e.parent = bag; e.data.materials.append(tin)
# one-way degassing valve, upper front
bpy.ops.mesh.primitive_cylinder_add(radius=0.0075, depth=0.0016, vertices=64, location=(0, 0, 0))
va = bpy.context.object; va.rotation_euler = (math.radians(72), 0, 0); va.location = (0.0, -0.0156, 0.168); va.parent = bag
bv = va.modifiers.new('bev', 'BEVEL'); bv.width = 0.0008; bv.segments = 3; C.smooth(va)
valve_m = C.principled('valve', color=(0.012, 0.012, 0.013), rough=0.55, **{'Specular IOR Level': 0.3})
va.data.materials.append(valve_m)
bpy.ops.mesh.primitive_torus_add(major_radius=0.0042, minor_radius=0.0006, location=(0, 0, 0))   # the moulded inner ring
vr = bpy.context.object; vr.rotation_euler = va.rotation_euler; vr.location = (0.0, -0.0164, 0.1683); vr.parent = bag
vr.data.materials.append(valve_m)
# a small round seal sticker, matte black, blank

bpy.context.view_layer.update()

# ---------- beans: one modelled bean, 220 copies dropped with rigid bodies at 10x scale ----------
def bean_mesh():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=18, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if z < 0:
            z *= 0.45
            g = max(0.0, 1 - abs(y + 0.06 * math.sin(x * 3.2)) / 0.16)  # the centre cut, slightly S-shaped
            z += 0.32 * g * g * (1 - abs(x) ** 4)
        v.co = Vector((x * 0.575, y * 0.43, z * 0.3))
    me = bpy.data.meshes.new('bean'); bm.to_mesh(me); bm.free()
    return me

bean_me = bean_mesh()
bean_m = C.principled('roasted_bean', color=(0.05, 0.022, 0.01), rough=0.38, **{'Coat Weight': 0.35, 'Coat Roughness': 0.25,
                                                                               'Subsurface Weight': 0.0})
C.obj_random_color(bean_m, 0.35)
nb = bean_m.node_tree.nodes
bump = nb.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.25
nn = nb.new('ShaderNodeTexNoise'); nn.inputs['Scale'].default_value = 900
bean_m.node_tree.links.new(nn.outputs['Fac'], bump.inputs['Height'])
bean_m.node_tree.links.new(bump.outputs['Normal'], nb['Principled BSDF'].inputs['Normal'])

SIM = 10.0
NB = int(E('BEANS', '169'))
BSCALE = float(E('BSCALE', '0.0095'))
import json
cache = os.path.join(C.OUT, f"roastery_beans_{NB}_{E('SIMF', '90')}_{BSCALE}_{BAG_X}_{E('BAGROT', '-28')}_{E('HEAP', 'a')}.json")
if os.path.exists(cache):
    poses = json.load(open(cache))
else:
    sc.rigidbody_world if sc.rigidbody_world else bpy.ops.rigidbody.world_add()
    sc.rigidbody_world.substeps_per_frame = 10
    sc.rigidbody_world.solver_iterations = 10
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); floor = bpy.context.object
    bpy.ops.rigidbody.object_add(); floor.rigid_body.type = 'PASSIVE'; floor.rigid_body.friction = 0.8
    bc = bpy.data.objects.new('bagcol', bag.data.copy()); sc.collection.objects.link(bc)
    bc.matrix_world = mathutils.Matrix.Scale(SIM, 4) @ bag.matrix_world
    bpy.context.view_layer.objects.active = bc; bc.select_set(True)
    bpy.ops.rigidbody.object_add(); bc.rigid_body.type = 'PASSIVE'; bc.rigid_body.collision_shape = 'CONVEX_HULL'
    sims = []
    for i in range(NB):
        o = bpy.data.objects.new(f'simbean{i}', bean_me); sc.collection.objects.link(o)
        if i < NB * 0.82:  # a heap, poured from just above the counter in front-left of the bag
            r = abs(rng.gauss(0, 0.018)); a = rng.uniform(0, 2 * math.pi)
            x, y = -0.035 + r * math.cos(a) * 1.5, -0.06 + r * math.sin(a)
            z = 0.01 + i * 0.0011
        else:  # strays that rolled off
            x, y, z = rng.uniform(-0.2, 0.06), rng.uniform(-0.22, -0.02), 0.01 + rng.uniform(0, 0.02)
        o.location = (x * SIM, y * SIM, z * SIM)
        o.rotation_euler = (rng.uniform(0, 6.3), rng.uniform(0, 6.3), rng.uniform(0, 6.3))
        o.scale = (SIM * BSCALE * rng.uniform(0.88, 1.1),) * 3
        sims.append(o)
    for o in sims:
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.rigidbody.object_add()
        o.rigid_body.collision_shape = 'CONVEX_HULL'; o.rigid_body.mass = 0.02
        o.rigid_body.friction = 0.75; o.rigid_body.restitution = 0.1
        o.rigid_body.linear_damping = 0.3; o.rigid_body.angular_damping = 0.4
        o.select_set(False)
    sc.frame_start = 1; sc.frame_end = 200
    sc.rigidbody_world.point_cache.frame_end = 200
    for f in range(1, int(E('SIMF', '90'))):
        sc.frame_set(f)
        if f % 10 == 0: print('frame', f, round(time.time() - T0), flush=True)
    poses = []
    for o in sims:
        loc, rot, scl = o.matrix_world.decompose()
        poses.append([list(loc / SIM), list(rot), list(scl / SIM)])
    for o in sims + [floor, bc]:
        bpy.data.objects.remove(o)
    bpy.ops.rigidbody.world_remove()
    sc.frame_set(1)
    os.makedirs(C.OUT, exist_ok=True)
    json.dump(poses, open(cache, 'w'))
bean_me.materials.append(bean_m)
for i, (loc, rot, scl) in enumerate(poses):
    o = bpy.data.objects.new(f'bean{i}', bean_me); sc.collection.objects.link(o)
    o.location = loc; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = rot; o.scale = scl
for p in bean_me.polygons:
    p.use_smooth = True
# a few beans resting on the bag's top fold read as "just poured"; skip, keep it clean

print('SIM done', time.time() - T0)
# ---------- the cup: matte charcoal stoneware with black coffee, steam ----------
CUP = Vector((float(E('CUPX', '-0.17')), 0.24, 0.0))
stone = C.principled('stoneware', color=(0.035, 0.033, 0.03), rough=0.42, **{'Coat Weight': 0.4, 'Coat Roughness': 0.2})
sp = stone.node_tree.nodes; spn = sp.new('ShaderNodeTexNoise'); spn.inputs['Scale'].default_value = 300
sb = sp.new('ShaderNodeBump'); sb.inputs['Strength'].default_value = 0.08
stone.node_tree.links.new(spn.outputs['Fac'], sb.inputs['Height']); stone.node_tree.links.new(sb.outputs['Normal'], sp['Principled BSDF'].inputs['Normal'])
cup_prof = [(0.0, 0.0), (0.03, 0.0), (0.034, 0.003), (0.036, 0.01), (0.04, 0.05), (0.042, 0.082), (0.0405, 0.084),
            (0.0375, 0.08), (0.0345, 0.04), (0.031, 0.01), (0.0, 0.008)]
C.lathe('cup', cup_prof, CUP, stone, sub=2)
coffee = C.principled('coffee', color=(0.012, 0.006, 0.003), rough=0.03, **{'Coat Weight': 0.0})
bpy.ops.mesh.primitive_cylinder_add(radius=0.0375, depth=0.001, vertices=96, location=(CUP.x, CUP.y, 0.072))
bpy.context.object.data.materials.append(coffee)
# steam: thin wisps from stretched, distorted noise, fading with height
bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.32, vertices=48, location=(CUP.x, CUP.y, 0.074 + 0.16))
steam = bpy.context.object; steam.name = 'steam'
sm = bpy.data.materials.new('steam'); sm.use_nodes = True
N, L = sm.node_tree.nodes, sm.node_tree.links
N.remove(N['Principled BSDF'])
tc = N.new('ShaderNodeTexCoord')
sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
# swirl: offset x by a slow noise of z so the column leans and curls
wob = N.new('ShaderNodeTexNoise'); wob.inputs['Scale'].default_value = 3.0; wob.inputs['Detail'].default_value = 2
L.new(tc.outputs['Object'], wob.inputs['Vector'])
mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (9, 9, 2.2)
vadd = N.new('ShaderNodeVectorMath'); vadd.operation = 'ADD'
L.new(tc.outputs['Object'], vadd.inputs[0]); L.new(wob.outputs['Color'], vadd.inputs[1])
L.new(vadd.outputs['Vector'], mp.inputs['Vector'])
n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 1.6; n.inputs['Detail'].default_value = 6
n.inputs['Distortion'].default_value = 2.5; n.inputs['Roughness'].default_value = 0.55
L.new(mp.outputs['Vector'], n.inputs['Vector'])
cr = N.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.56; cr.inputs['From Max'].default_value = 0.75
L.new(n.outputs['Fac'], cr.inputs['Value'])
# radial falloff around the cup axis that widens with height
rad = N.new('ShaderNodeVectorMath'); rad.operation = 'LENGTH'
cxy = N.new('ShaderNodeCombineXYZ'); L.new(sep.outputs['X'], cxy.inputs['X']); L.new(sep.outputs['Y'], cxy.inputs['Y'])
L.new(cxy.outputs[0], rad.inputs[0])
width = N.new('ShaderNodeMapRange'); width.inputs['From Min'].default_value = -0.16; width.inputs['From Max'].default_value = 0.16
width.inputs['To Min'].default_value = 0.022; width.inputs['To Max'].default_value = 0.06
L.new(sep.outputs['Z'], width.inputs['Value'])
rdiv = N.new('ShaderNodeMath'); rdiv.operation = 'DIVIDE'; L.new(rad.outputs['Value'], rdiv.inputs[0]); L.new(width.outputs['Result'], rdiv.inputs[1])
rfall = N.new('ShaderNodeMapRange'); rfall.inputs['From Min'].default_value = 0.3; rfall.inputs['From Max'].default_value = 1.0
rfall.inputs['To Min'].default_value = 1.0; rfall.inputs['To Max'].default_value = 0.0
L.new(rdiv.outputs[0], rfall.inputs['Value'])
hfall = N.new('ShaderNodeMapRange'); hfall.inputs['From Min'].default_value = -0.16; hfall.inputs['From Max'].default_value = 0.15
hfall.inputs['To Min'].default_value = 1.0; hfall.inputs['To Max'].default_value = 0.0
L.new(sep.outputs['Z'], hfall.inputs['Value'])
base = N.new('ShaderNodeMapRange'); base.inputs['From Min'].default_value = -0.16; base.inputs['From Max'].default_value = -0.145
L.new(sep.outputs['Z'], base.inputs['Value'])
m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; L.new(cr.outputs['Result'], m1.inputs[0]); L.new(rfall.outputs['Result'], m1.inputs[1])
m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; L.new(m1.outputs[0], m2.inputs[0]); L.new(hfall.outputs['Result'], m2.inputs[1])
m3 = N.new('ShaderNodeMath'); m3.operation = 'MULTIPLY'; L.new(m2.outputs[0], m3.inputs[0]); L.new(base.outputs['Result'], m3.inputs[1])
dens = N.new('ShaderNodeMath'); dens.operation = 'MULTIPLY'; dens.inputs[1].default_value = float(E('STEAM', '5'))
L.new(m3.outputs[0], dens.inputs[0])
vs = N.new('ShaderNodeVolumeScatter'); vs.inputs['Anisotropy'].default_value = 0.65; vs.inputs['Color'].default_value = (0.95, 0.95, 0.95, 1)
L.new(dens.outputs[0], vs.inputs['Density'])
L.new(vs.outputs[0], N['Material Output'].inputs['Volume'])
steam.data.materials.append(sm)
steam.visible_shadow = False

# ---------- back bar: plaster wall, a shelf with jars, the amber strip under it ----------
wall = C.principled('wall', color=(0.03, 0.03, 0.032), rough=0.9)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 1.5, 0.6), rotation=(math.radians(90), 0, 0))
w = bpy.context.object; w.scale = (6, 2.5, 1); w.data.materials.append(wall)
shelf_m = C.principled('shelf', color=(0.02, 0.012, 0.008), rough=0.5)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.38, 0.34)); s = bpy.context.object; s.scale = (3.0, 0.24, 0.03); s.data.materials.append(shelf_m)
glass = C.glass('jar_glass', ior=1.5)
for i in range(9):
    x = -1.1 + i * 0.27 + rng.uniform(-0.03, 0.03)
    h = rng.uniform(0.16, 0.24)
    C.lathe('jar', [(0.0, 0.0), (0.055, 0.0), (0.058, 0.004), (0.058, h - 0.02), (0.045, h), (0.0, h)], (x, 1.36, 0.355), glass, sub=1)
    C.lathe('jar_beans', [(0.0, 0.0), (0.054, 0.0), (0.054, h * 0.6), (0.0, h * 0.62)], (x, 1.36, 0.358), C.principled('beans_far', color=(0.07, 0.035, 0.015), rough=0.6), sub=0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.485, 0.362)); led = bpy.context.object; led.scale = (2.9, 0.012, 0.004)
led.data.materials.append(C.emission('amber_led', C.kelvin(2200), float(E('LED', '8'))))
C.light(sc, 'AREA', (0, 1.47, 0.37), target=(0, 1.5, 1.0), energy=float(E('LEDL', '5')), color=C.kelvin(2200), size=2.9, size_y=0.02,
        shape='RECTANGLE', name='led_wash')

# ---------- the bulb: Poly Haven lightbulb_01 hanging on a cord, filament glowing ----------
BULB = Vector((float(E('BULBX', '-0.06')), float(E('BULBY', '0.42')), float(E('BULBZ', '0.27'))))
bobjs = C.model('lightbulb_01', '1k')
bmeshes = [o for o in bobjs if o.type == 'MESH']
root = bobjs[0]
while root.parent: root = root.parent
bpy.context.view_layer.update()
zs = [(o.matrix_world @ v.co).z for o in bmeshes for v in o.data.vertices]
zmax = max(zs)
root.rotation_mode = 'XYZ'
root.rotation_euler = (math.radians(180), 0, 0)  # hang it: base up, glass down
root.location = (BULB.x, BULB.y, BULB.z + zmax)
for o in bmeshes:
    for i, m in enumerate(o.data.materials):
        nm = m.name.lower()
        if 'glass' in nm or (m.node_tree and any(l.to_socket.name == 'Alpha' for l in m.node_tree.links)):
            o.data.materials[i] = C.glass('bulb_glass', ior=1.5, tint=(1.0, 0.96, 0.9))
        else:
            m.surface_render_method = 'DITHERED'
bpy.context.view_layer.update()
_pts = [o.matrix_world @ v.co for o in bmeshes for v in o.data.vertices]
_zlo = min(p.z for p in _pts); _zhi = max(p.z for p in _pts)
FIL_Z = _zlo + 0.36 * (_zhi - _zlo)  # the filament sits in the widest part of the glass, below the base
print('BULB z', round(_zlo, 3), round(_zhi, 3))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0035, location=(BULB.x, BULB.y, FIL_Z))
fil = bpy.context.object; fil.scale = (0.6, 0.6, 2.4); fil.data.materials.append(C.emission('filament', C.kelvin(2300), float(E('FIL', '45'))))
fil.visible_shadow = False
bl = C.light(sc, 'POINT', (BULB.x, BULB.y, FIL_Z), energy=float(E('BULBW', '22')), color=C.kelvin(2500), size=0.015, name='bulb')
# the bulb's light does the lighting; what the eye sees through the glass is only the filament
bl.visible_camera = False; bl.visible_transmission = False; bl.visible_glossy = False
bpy.ops.mesh.primitive_cylinder_add(radius=0.0025, depth=1.5, location=(BULB.x, BULB.y, BULB.z + zmax + 0.75))
bpy.context.object.data.materials.append(C.principled('cord', color=(0.01, 0.01, 0.01), rough=0.6))
# key: the next pendant along the bar, off frame front-left, rakes the bag's face
C.light(sc, 'AREA', (-0.22, -0.05, 0.36), target=(BAG_X, BAG_Y, 0.08), energy=float(E('KEY', '7')), color=C.kelvin(2500), size=0.07,
        shape='DISK', name='key')
# backlight for the steam (hidden behind the cup, scatters forward)
C.light(sc, 'SPOT', (CUP.x + 0.05, CUP.y + 0.45, 0.12), target=(CUP.x, CUP.y, 0.2), energy=float(E('STEAMW', '6')), color=C.kelvin(3000),
        size=0.02, spot=math.radians(25), blend=0.5, name='steam_back')
# cool night spill from a window off to the left: the only cool note, keeps the warm light honest
C.light(sc, 'AREA', (-1.4, 0.2, 0.9), target=(0.0, 0.1, 0.05), energy=float(E('WIN', '14')), color=C.kelvin(7500), size=1.5, name='window')
# a soft warm bounce from the room in front so the bag face isn't black
C.light(sc, 'AREA', (-0.5, -0.9, 0.5), target=(BAG_X, BAG_Y, 0.08), energy=float(E('FILL', '1.5')), color=C.kelvin(3600), size=1.2, name='fill')
# a hard-ish kick from behind right that rakes the bean pile and edges the bag
C.light(sc, 'SPOT', (0.45, 0.55, 0.35), target=(-0.02, -0.05, 0.0), energy=float(E('KICK', '25')), color=C.kelvin(2400), size=0.03,
        spot=math.radians(30), blend=0.6, name='kick')

cam = C.camera(sc, (float(E('CAMX', '-0.08')), float(E('CAMY', '-0.8')), float(E('CAMZ', '0.12'))), (-0.03, 0.1, 0.12),
               lens=float(E('LENS', '60')), fstop=float(E('FSTOP', '2.8')))
cam.data.dof.focus_distance = (Vector((BAG_X - 0.04, BAG_Y - 0.06, 0.06)) - cam.location).length
cam.data.shift_y = float(E('SHY', '0.0'))
cam.data.shift_x = float(E('SHX', '0.0'))

C.render(sc, 'roastery', 'bag')
