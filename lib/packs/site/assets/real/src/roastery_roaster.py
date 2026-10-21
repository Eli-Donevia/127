# roastery / roaster: a fresh batch tipped into the round cooling tray beside the drum roaster: a deep bed of beans
# (instanced, randomly turned, three layers so the surface is lumpy like a real bed), stainless stirring arms resting
# in it, and the roaster's black drum face behind with its sight glass glowing from the burner. Warm, dark room.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, bmesh
import numpy as np
from mathutils import Vector

E = os.environ.get
W, H = 1600, 1000
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '96')), exposure=float(E('EXPO', '0')))
C.world_color(sc, (0.001, 0.001, 0.0012))
BS = 0.0095  # bean scale: ~11 mm long


def bean_verts():
    """One roasted bean (unit scale): an ellipsoid flattened on the underside with the centre crease pressed in."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if z < 0:
            z *= 0.45
            g = max(0.0, 1 - abs(y + 0.06 * math.sin(x * 3.2)) / 0.16)
            z += 0.32 * g * g * (1 - abs(x) ** 4)
        v.co = Vector((x * 0.575, y * 0.43, z * 0.3))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    V = np.array([v.co[:] for v in bm.verts]); T = np.array([[v.index for v in f.verts] for f in bm.faces])
    bm.free()
    return V, T


def rot(yaw, tilt, roll):
    cy, sy, ct, st, cr, sr = np.cos(yaw), np.sin(yaw), np.cos(tilt), np.sin(tilt), np.cos(roll), np.sin(roll)
    Rz = np.stack([np.stack([cy, -sy, 0 * cy], -1), np.stack([sy, cy, 0 * cy], -1), np.stack([0 * cy, 0 * cy, 1 + 0 * cy], -1)], -2)
    Rx = np.stack([np.stack([1 + 0 * ct, 0 * ct, 0 * ct], -1), np.stack([0 * ct, ct, -st], -1), np.stack([0 * ct, st, ct], -1)], -2)
    Ry = np.stack([np.stack([cr, 0 * cr, sr], -1), np.stack([0 * cr, 1 + 0 * cr, 0 * cr], -1), np.stack([-sr, 0 * cr, cr], -1)], -2)
    return Rz @ Rx @ Ry


def bean_bed(name, n, rmax, zfun, seed, mat, scale=BS, flip=0.12):
    """n beans scattered over a disc as ONE mesh (numpy), each turned at random, a few lying on their backs.
    Per-bean random value in the 'rnd' point attribute drives the colour variation."""
    g = np.random.default_rng(seed)
    V, T = bean_verts()
    r = rmax * np.sqrt(g.random(n)); a = g.random(n) * 2 * np.pi
    x, y = r * np.cos(a), r * np.sin(a)
    z = zfun(x, y, g)
    up = g.random(n) < flip
    Rm = rot(g.random(n) * 2 * np.pi, g.normal(0, 0.35, n) + np.where(up, np.pi, 0), g.normal(0, 0.3, n))
    sc_ = scale * (1 + g.normal(0, 0.08, n))
    P = np.einsum('nij,vj->nvi', Rm, V) * sc_[:, None, None] + np.stack([x, y, z], -1)[:, None, :]
    nv = len(V)
    F = (T[None] + (np.arange(n) * nv)[:, None, None]).reshape(-1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(n * nv); me.vertices.foreach_set('co', P.reshape(-1).astype(np.float32))
    me.loops.add(len(F)); me.loops.foreach_set('vertex_index', F.astype(np.int32))
    me.polygons.add(len(F) // 3); me.polygons.foreach_set('loop_start', np.arange(0, len(F), 3, dtype=np.int32))
    me.update(calc_edges=True)
    me.shade_smooth()
    at = me.attributes.new('rnd', 'FLOAT', 'POINT'); at.data.foreach_set('value', np.repeat(g.random(n), nv).astype(np.float32))
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o


def bean_material():
    m = C.principled('roasted_bean', color=(0.05, 0.022, 0.01), rough=0.42, **{'Coat Weight': 0.18, 'Coat Roughness': 0.3})
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'rnd'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position = 0.0; el[0].color = (0.028, 0.012, 0.006, 1)
    el[1].position = 1.0; el[1].color = (0.085, 0.04, 0.018, 1)
    nt.links.new(at.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


bean_m = bean_material()

steel = C.principled('stainless', color=(0.62, 0.62, 0.63), rough=0.28, metal=1.0)
brushed = C.principled('brushed', color=(0.55, 0.55, 0.56), rough=0.35, metal=1.0, **{'Anisotropic': 0.6})
black_enamel = C.principled('black_enamel', color=(0.015, 0.015, 0.016), rough=0.22, **{'Coat Weight': 0.6, 'Coat Roughness': 0.1})

# ---------- cooling tray: stainless drum, beans in a slightly domed bed ----------
R = 0.48; TZ = 0.0
C.lathe('tray_wall', [(R, 0.0), (R, 0.11), (R + 0.012, 0.115), (R + 0.012, 0.1), (R + 0.004, 0.0)], (0, 0, TZ), steel, sub=1, steps=128)
# the bed: a dark under-surface so gaps read as shadow, then two layers of beans, gently domed and lumpy
BED = R - 0.016
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=BED + 0.004, fill_type='NGON', location=(0, 0, TZ + 0.03))
bpy.context.object.data.materials.append(C.principled('bed_shadow', color=(0.012, 0.006, 0.003), rough=0.6))


def dome(base):
    return lambda x, y, g: (TZ + base + 0.012 * (1 - (x * x + y * y) / BED ** 2) + 0.004 * np.sin(x * 23) * np.cos(y * 19)
                            + g.normal(0, 0.0018, len(x)))


bean_bed('beans_low', int(E('BLOW', '5000')), BED, dome(0.036), 5, bean_m)
bean_bed('beans_top', int(E('BEANS', '8500')), BED, dome(0.043), 6, bean_m)

# stirring arms: a hub and two flat arms with paddles, resting just in the beans
hub = C.lathe('hub', [(0.0, 0.0), (0.03, 0.0), (0.03, 0.09), (0.02, 0.1), (0.0, 0.1)], (0, 0, TZ + 0.02), brushed, sub=1)
for a in (math.radians(55), math.radians(175), math.radians(295)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * R * 0.47, math.sin(a) * R * 0.47, TZ + 0.075))
    arm = bpy.context.object; arm.scale = (R * 0.9, 0.022, 0.008); arm.rotation_euler = (0, 0, a)
    bv = arm.modifiers.new('bev', 'BEVEL'); bv.width = 0.003; bv.segments = 3; arm.data.materials.append(brushed)
    for f in (0.35, 0.7):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * R * f, math.sin(a) * R * f, TZ + 0.06))
        pad = bpy.context.object; pad.scale = (0.006, 0.07, 0.04); pad.rotation_euler = (0, 0, a + math.radians(35))
        bv = pad.modifiers.new('bev', 'BEVEL'); bv.width = 0.002; bv.segments = 2; pad.data.materials.append(brushed)

# ---------- the roaster behind left: black enamel body, round cast front with the drum door, sight glass and chute ----------
RX, RF = -0.72, 0.6          # body centre x, front face y
DZ = 0.36                     # drum centre height
bpy.ops.mesh.primitive_cube_add(size=1, location=(RX, RF + 0.48, -0.6 + 0.66))
body = bpy.context.object; body.scale = (0.86, 0.96, 1.32)
bv = body.modifiers.new('bev', 'BEVEL'); bv.width = 0.03; bv.segments = 4; body.data.materials.append(black_enamel)
# cast front: a thick disc proud of the body, a steel ring, then the door
bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=0.05, vertices=128, location=(RX, RF - 0.025, DZ), rotation=(math.radians(90), 0, 0))
fr = bpy.context.object; bv = fr.modifiers.new('bev', 'BEVEL'); bv.width = 0.012; bv.segments = 4; fr.data.materials.append(black_enamel); C.smooth(fr)
bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.01, location=(RX, RF - 0.052, DZ), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(steel)
for i in range(10):
    a = 2 * math.pi * (i + 0.3) / 10
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=0.012, vertices=12, location=(RX + math.cos(a) * 0.335, RF - 0.053, DZ + math.sin(a) * 0.335),
                                        rotation=(math.radians(90), 0, 0))
    bpy.context.object.data.materials.append(steel)
# sight glass, burner glow behind it (the scene's amber practical, a real light source on a roaster)
SG = Vector((RX + 0.14, RF - 0.055, DZ + 0.12))
bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=0.01, vertices=64, location=SG, rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(C.emission('burner_glow', C.kelvin(1350), float(E('GLOW', '1.0'))))
bpy.ops.mesh.primitive_torus_add(major_radius=0.062, minor_radius=0.009, location=SG - Vector((0, 0.004, 0)), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(brushed)
# door handle: a steel bar on two standoffs, off centre
for dx in (-0.1, 0.06):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.007, depth=0.05, vertices=16, location=(RX + dx, RF - 0.075, DZ - 0.14), rotation=(math.radians(90), 0, 0))
    bpy.context.object.data.materials.append(steel)
bpy.ops.mesh.primitive_cylinder_add(radius=0.011, depth=0.22, vertices=24, location=(RX - 0.02, RF - 0.1, DZ - 0.14), rotation=(0, math.radians(90), 0))
bpy.context.object.data.materials.append(steel)
# trier port and a probe stub
bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.08, vertices=24, location=(RX - 0.2, RF - 0.07, DZ + 0.06), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(brushed)
# discharge chute: a sloped steel trough from under the door down onto the tray rim
p0 = Vector((RX + 0.08, RF - 0.06, DZ - 0.24)); p1 = Vector((-0.33, 0.33, TZ + 0.13))
mid = (p0 + p1) / 2; d = p1 - p0
bpy.ops.mesh.primitive_cube_add(size=1, location=mid); ch = bpy.context.object
ch.scale = (0.16, d.length, 0.012)
ch.rotation_euler = d.to_track_quat('Y', 'Z').to_euler()
bv = ch.modifiers.new('bev', 'BEVEL'); bv.width = 0.004; bv.segments = 2; ch.data.materials.append(steel)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=mid); sd = bpy.context.object
    sd.scale = (0.006, d.length, 0.05); sd.rotation_euler = ch.rotation_euler
    sd.location = mid + ch.matrix_world.to_3x3() @ Vector((0, 0, 0)) ; bpy.context.view_layer.update()
    sd.location = mid + (ch.rotation_euler.to_matrix() @ Vector((sx * 0.08, 0, 0.02)))
    bv = sd.modifiers.new('bev', 'BEVEL'); bv.width = 0.002; bv.segments = 2; sd.data.materials.append(steel)
# hopper on top (mostly out of frame, gives the silhouette)
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.08, radius2=0.26, depth=0.32, location=(RX, RF + 0.3, 0.72 + 0.16), rotation=(0, 0, math.radians(45)))
hp = bpy.context.object; bv = hp.modifiers.new('bev', 'BEVEL'); bv.width = 0.006; bv.segments = 2; hp.data.materials.append(brushed)

# floor and back wall
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.6)); bpy.context.object.data.materials.append(C.principled('floor', color=(0.02, 0.02, 0.02), rough=0.6))
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 2.2, 1), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(C.principled('wall', color=(0.03, 0.028, 0.026), rough=0.9))
bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=0.6, vertices=64, location=(0, 0, TZ - 0.3))
bpy.context.object.data.materials.append(black_enamel)

# ---------- light ----------
C.light(sc, 'AREA', (0.25, -0.1, 1.3), target=(0, 0, 0.05), energy=float(E('TOP', '28')), color=C.kelvin(2900), size=0.35, shape='DISK', name='pendant')
C.light(sc, 'POINT', SG - Vector((0, 0.03, 0)), energy=float(E('GLOWL', '1.2')), color=C.kelvin(1600), size=0.04, name='glow')
C.light(sc, 'AREA', (-1.4, 1.6, 1.6), target=(RX, RF, 0.4), energy=float(E('KICK', '30')), color=C.kelvin(3200), size=0.6, name='kick')
C.light(sc, 'AREA', (1.6, 0.2, 0.8), target=(0, 0, 0.05), energy=float(E('WIN', '16')), color=C.kelvin(7000), size=1.4, name='window')

cam = C.camera(sc, (float(E('CAMX', '0.72')), float(E('CAMY', '-1.08')), float(E('CAMZ', '0.74'))), (-0.3, 0.32, 0.14),
               lens=float(E('LENS', '38')), fstop=float(E('FSTOP', '2.8')))
cam.data.dof.focus_distance = (Vector((0.08, -0.12, 0.06)) - cam.location).length

C.render(sc, 'roastery', 'roaster')
