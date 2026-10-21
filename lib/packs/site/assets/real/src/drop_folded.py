# drop / p1..p6 and folded: folded garments on a dark concrete plinth under one hard spot. Each piece is a stack of
# soft folded layers (rounded fold edges, slight sag and creases) wearing a Poly Haven fabric scan (CC0):
#   p1 bone heavyweight tee (cotton_jersey)      p2 black tee (cotton_jersey)
#   p3 grey melange sweatshirt (jogging_melange) p4 indigo denim (denim_fabric)
#   p5 cream knit (knitted_fleece)               p6 sand linen overshirt (rough_linen)
#   folded: four of them stacked and laid along a long plinth, wide.
# Usage: SLOT=p1 python drop_folded.py   (SLOT=folded for the wide shot)
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import garment as G
import bpy, bmesh
from mathutils import Vector, noise

E = os.environ.get
SLOT = E('SLOT', 'p1')
W, H = (1600, 1000) if SLOT == 'folded' else (1000, 1250)
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '96')), exposure=float(E('EXPO', '0')))
C.world_color(sc, (0.0008, 0.0008, 0.0009))

PIECES = {
    'p1': dict(spot=200, tex='cotton_jersey', col=(0.62, 0.58, 0.52), sat=0.0, uv=3.0, w=0.27, d=0.21, layers=3, lt=0.014, gap=0.0035, collar=True, rough=(0.4, 0.6)),
    'p2': dict(spot=230, sheen=0.1, tex='cotton_jersey', col=(0.016, 0.016, 0.017), sat=0.0, uv=3.0, w=0.27, d=0.21, layers=3, lt=0.014, gap=0.0035, collar=True, rough=(0.4, 0.55)),
    'p3': dict(spot=330, tex='jogging_melange', col=(1.0, 1.0, 1.0), sat=0.0, uv=2.5, w=0.29, d=0.23, layers=3, lt=0.016, gap=0.006, collar=True, rough=(0.5, 0.5)),
    'p4': dict(spot=380, tex='denim_fabric', col=(1.0, 1.0, 1.0), sat=1.0, uv=2.0, w=0.3, d=0.2, layers=4, lt=0.012, gap=0.0042, collar=False, rough=(0.3, 0.65)),
    'p5': dict(spot=300, tex='knitted_fleece', col=(0.9, 0.86, 0.78), sat=0.25, uv=1.2, w=0.3, d=0.24, layers=3, lt=0.019, gap=0.0055, collar=True, rough=(0.3, 0.7)),
    'p6': dict(spot=260, tex='rough_linen', col=(0.6, 0.47, 0.3), sat=0.5, uv=2.5, w=0.28, d=0.22, layers=3, lt=0.009, gap=0.003, collar=True, rough=(0.3, 0.65)),
}


def fabric(name, spec):
    t = C.texture(spec['tex'], '2k')
    m = C.pbr(name, t, scale=1.0, color_mult=spec['col'], hue_sat=(0.5, spec['sat'], 1.0), rough_mult=spec['rough'][0],
              rough_add=spec['rough'][1], bump=1.0, sheen=spec.get('sheen', 0.5), metal=0.0)
    # cloth has a low, broad specular: keep the Fresnel sheen from greying dark fabrics under the spot
    m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = spec.get('spec', 0.2)
    return m


def folded_piece(spec, loc, rz=0.0, seed=0):
    mat = fabric(f"fab_{spec['tex']}_{seed}", spec)
    o, depth = G.folded_tee(f"piece{seed}", gap=spec['gap'], scale=spec.get('scale', 1.0), seed=seed)
    o.rotation_euler = (0, 0, rz)
    o.location = (loc[0], loc[1], loc[2] + depth + spec['gap'] * 0.35)
    o.data.materials.append(mat)
    # rib collar around the neck opening of the top layer
    ring = [Vector(p) for p in o['neck']]
    if len(ring) > 8:
        cx = sum(p.x for p in ring) / len(ring); cy = sum(p.y for p in ring) / len(ring)
        ring.sort(key=lambda p: math.atan2(p.y - cy, p.x - cx))
        cu = bpy.data.curves.new('collar', 'CURVE'); cu.dimensions = '3D'
        sp = cu.splines.new('NURBS'); sp.points.add(len(ring) - 1)
        for pt, p in zip(sp.points, ring): pt.co = (p.x, p.y, p.z, 1)
        sp.use_cyclic_u = True; sp.order_u = 4
        cu.bevel_depth = spec['gap'] * 0.9; cu.bevel_resolution = 4
        col = bpy.data.objects.new('collar', cu); sc.collection.objects.link(col)
        col.parent = o; col.data.materials.append(mat)
    for ob in [o] + list(o.children):
        ob.data.transform(__import__('mathutils').Matrix.Translation((0, 0.185, 0)))
    # the next piece sits right on this one's top surface (evaluated, with solidify and subsurf)
    bpy.context.view_layer.update()
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    top = max((o.matrix_world @ v.co).z for v in ev.to_mesh().vertices); ev.to_mesh_clear()
    return [o], top - 0.0015


# ---------- room and plinth ----------
conc = C.texture('concrete_wall_008', '2k')
wall_m = C.pbr('concrete_wall', conc, scale=1.0, color_mult=(0.4, 0.4, 0.41), hue_sat=(0.5, 0.25, 1.0), bump=1.0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.2, 1.5)); wall = bpy.context.object; wall.scale = (8, 0.2, 4)
bpy.ops.object.transform_apply(scale=True); C.uv_box(wall, 0.35); wall.data.materials.append(wall_m)
floor_t = C.texture('concrete_floor_02', '2k')
floor_m = C.pbr('concrete_floor', floor_t, scale=1.0, hue_sat=(0.5, 0.3, 1.0), color_mult=(0.3, 0.3, 0.31), rough_mult=0.8, bump=0.8)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); fl = bpy.context.object; fl.scale = (8, 8, 1)
bpy.ops.object.transform_apply(scale=True); C.uv_box(fl, 0.4); fl.data.materials.append(floor_m)
plinth_m = C.pbr('plinth', floor_t if SLOT == 'folded' else conc, scale=1.0, color_mult=(0.07, 0.07, 0.072), hue_sat=(0.5, 0.2, 1.0), rough_mult=0.9, bump=1.2)
PW = 1.6 if SLOT == 'folded' else 0.7
PH = 0.9
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, PH / 2)); pl = bpy.context.object; pl.scale = (PW, 0.6, PH)
bpy.ops.object.transform_apply(scale=True); C.uv_box(pl, 0.8)
bv = pl.modifiers.new('bev', 'BEVEL'); bv.width = 0.004; bv.segments = 3
pl.data.materials.append(plinth_m)

# ---------- the pieces ----------
if SLOT == 'folded':
    order = ['p2', 'p1', 'p3', 'p4', 'p5', 'p6']
    xs = [-0.55, -0.2, 0.14, 0.5]
    stacks = [['p3', 'p1', 'p2'], ['p4'], ['p1', 'p6'], ['p5', 'p3']]   # bottom to top: black, denim, sand, melange on top
    for i, x in enumerate(xs):
        stack = stacks[i]
        z = PH
        for k, key in enumerate(stack):
            _, z = folded_piece(PIECES[key], (x + 0.004 * k, -0.02, z), rz=math.radians([-4, 3, -7, 5][i] + [0, 3, -2][k]), seed=i * 7 + k)
    focus = Vector((-0.1, -0.05, PH + 0.03))
else:
    spec = PIECES[SLOT]
    folded_piece(spec, (0.0, 0.0, PH), rz=math.radians(float(E('RZ', '-8'))), seed=int(SLOT[1]))
    focus = Vector((0, -0.02, PH + 0.03))

# ---------- light ----------
C.light(sc, 'SPOT', (float(E('SPX', '0.9' if SLOT != 'folded' else '0.6')), float(E('SPY', '0.2' if SLOT != 'folded' else '-0.3')), PH + float(E('SPZ', '1.1' if SLOT != 'folded' else '2.3'))), target=(0, 0, PH), energy=float(E('SPOT', str(PIECES[SLOT]['spot']) if SLOT != 'folded' else '700')), color=C.kelvin(4300),
        size=0.012, spot=math.radians(float(E('CONE', '42' if SLOT == 'folded' else '18'))), blend=float(E('BLEND', '0.3')), name='spot')
C.light(sc, 'AREA', (-1.6, -1.6, PH + 0.6), target=(0, 0, PH), energy=float(E('FILL', '5')), color=C.kelvin(5200), size=1.5, name='fill')
if True:
    # the quiet colour: a cyan wash grazing up the back wall from a floor cove, far behind and soft
    C.light(sc, 'AREA', (0.25, 1.0, 0.02), target=(0.25, 1.1, 2.0), energy=float(E('WASH', '6')), color=(0.3, 0.85, 1.0), size=1.2, size_y=0.05,
            shape='RECTANGLE', name='cove_wash')
if SLOT == 'folded':
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.09, 0.012)); cove = bpy.context.object; cove.scale = (6, 0.01, 0.006)
    cove.data.materials.append(C.emission('cove_cyan', (0.3, 0.85, 1.0), float(E('COVE', '8'))))

if SLOT == 'folded':
    cam = C.camera(sc, (0.18, -1.55, PH + float(E('CAMZ', '0.95'))), (0.0, 0.1, PH), lens=float(E('LENS', '40')), fstop=float(E('FSTOP', '4')))
else:
    cam = C.camera(sc, (float(E('CAMX', '0.1')), float(E('CAMY', '-0.78')), PH + float(E('CAMZ', '0.6'))), (0.0, 0.06, PH + 0.0),
                   lens=float(E('LENS', '58')), fstop=float(E('FSTOP', '3.5')))
cam.data.dof.focus_distance = (focus - cam.location).length

C.render(sc, 'drop', SLOT)
