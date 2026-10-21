# drop / hero: one heavyweight cotton tee on a wooden hanger, hung from a blackened steel rail in a bare concrete room,
# under a single hard spotlight. The tee is sewn from two flat panels and dropped onto the hanger with Blender's cloth
# solver (no pins: it falls onto the hanger and settles there), so it drapes like fabric. UVs come from the flat
# pattern, so the knit follows the cloth without stretching. Concrete and jersey from Poly Haven (CC0). Accent: a faint cyan cove line at the
# foot of the wall.
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, bmesh, mathutils
from mathutils import Vector

E = os.environ.get
SLOT = E('SLOT', 'hero')
W, H = (1200, 1500)
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '128')), exposure=float(E('EXPO', '0')))
C.world_color(sc, (0.0008, 0.0008, 0.0009))
NECK_Z = 1.75

# ---------- the tee pattern (front view, x across, z down from the neck point) ----------
HALF = [(0.0, -0.06), (0.05, -0.045), (0.085, -0.012), (0.095, 0.0), (0.25, -0.045), (0.405, -0.175), (0.335, -0.275),
        (0.258, -0.245), (0.262, -0.72), (0.0, -0.72)]
OUTLINE = HALF + [(-x, z) for x, z in reversed(HALF[1:-1])]
BACK_HALF = [(0.0, -0.018), (0.06, -0.012), (0.095, 0.0)] + HALF[4:]
BACK = BACK_HALF + [(-x, z) for x, z in reversed(BACK_HALF[1:-1])]


def inside(p, poly):
    x, z = p; c = False
    for i in range(len(poly)):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c


def closest_on_outline(p, poly=None):
    poly = poly or OUTLINE
    best, bd = None, 1e9
    for i in range(len(poly)):
        a = Vector(poly[i]); b = Vector(poly[(i + 1) % len(poly)])
        ab = b - a; t = max(0, min(1, (Vector(p) - a).dot(ab) / ab.length_squared))
        q = a + ab * t; d = (Vector(p) - q).length
        if d < bd: bd, best = d, (q, i)
    return best


def is_open(q, seg):
    """Hem, neck and sleeve openings stay open; every other edge of the outline is a seam."""
    a = OUTLINE[seg]; b = OUTLINE[(seg + 1) % len(OUTLINE)]
    hem = abs(a[1] + 0.72) < 1e-6 and abs(b[1] + 0.72) < 1e-6
    neck = abs(a[0]) <= 0.0951 and abs(b[0]) <= 0.0951 and a[1] > -0.07 and b[1] > -0.07
    cuff = {tuple(a), tuple(b)} in ({(0.405, -0.175), (0.335, -0.275)}, {(-0.405, -0.175), (-0.335, -0.275)})
    return hem or neck or cuff


STEP = float(E('GRID', '0.0125'))
cache = os.path.join(C.OUT, f"drop_tee_{STEP}_{E('SIMF', '110')}_{E('BEND', '0.12')}_{E('FRIC', '40')}_v8.json")
if os.path.exists(cache):
    data = json.load(open(cache))
    me = bpy.data.meshes.new('tee'); me.from_pydata(data['v'], [], data['f']); tee = bpy.data.objects.new('tee', me)
    sc.collection.objects.link(tee)
    REST = data['r']
else:
    xs = [i * STEP for i in range(int(-0.43 / STEP) - 1, int(0.43 / STEP) + 2)]
    zs = [-j * STEP for j in range(-1, int(0.74 / STEP) + 2)]
    bm = bmesh.new()
    panels = []
    for side, y in (('front', -0.027), ('back', 0.027)):
        vid = {}
        for i, x in enumerate(xs):
            for j, z in enumerate(zs):
                vid[(i, j)] = (x, z)
        quads = []
        for i in range(len(xs) - 1):
            for j in range(len(zs) - 1):
                c = [(xs[i] + STEP / 2), (zs[j] - STEP / 2)]
                if inside(c, OUTLINE if side == 'front' else BACK):
                    quads.append([(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)])
        used = {k for q in quads for k in q}
        vmap = {k: bm.verts.new((vid[k][0], y, vid[k][1])) for k in used}
        for q in quads:
            bm.faces.new([vmap[k] for k in q])
        panels.append(vmap)
    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table()
    # snap the stair-stepped boundary onto the pattern outline, then sew front to back along the seams
    sew = []
    pins = []
    snapped = {}
    for pi, poly in ((0, OUTLINE), (1, BACK)):
        for k, v in panels[pi].items():
            if v.is_boundary:
                q, seg = closest_on_outline((v.co.x, v.co.z), poly)
                v.co.x, v.co.z = q.x, q.y
                snapped[(pi, k)] = (q, seg)
    for k, vf in panels[0].items():
        if (0, k) not in snapped:
            continue
        q, seg = snapped[(0, k)]
        if is_open(q, seg) or (1, k) not in snapped:
            continue
        vb = panels[1][k]
        vb.co.x, vb.co.z = vf.co.x, vf.co.z
        sew.append((vf, vb))
    for vf, vb in sew:
        bm.edges.new((vf, vb))
    jr = random.Random(5)
    bm.verts.index_update()
    REST = [(v.co.x, v.co.z) for v in bm.verts]   # pattern coordinates: the UVs, so the knit never stretches
    for v in bm.verts:
        v.co.z += NECK_Z
        v.co.y += 0.003 * math.sin(v.co.x * 19 + 1.3) * (0.5 + 0.5 * math.sin(v.co.z * 7))
    bm.verts.index_update()
    me = bpy.data.meshes.new('tee'); bm.to_mesh(me); bm.free()
    tee = bpy.data.objects.new('tee', me); sc.collection.objects.link(tee)

# ---------- hanger: carved wood arms on a steel hook ----------
oak = C.principled('hanger_wood', color=(0.32, 0.2, 0.11), rough=0.35, **{'Coat Weight': 0.5, 'Coat Roughness': 0.15})
steel = C.principled('blackened_steel', color=(0.04, 0.04, 0.042), rough=0.38, metal=1.0)
cu = bpy.data.curves.new('hanger', 'CURVE'); cu.dimensions = '3D'
sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
for bp, co in zip(sp.bezier_points, [(-0.215, 0, NECK_Z - 0.068), (0, 0, NECK_Z - 0.012), (0.215, 0, NECK_Z - 0.068)]):
    bp.co = co; bp.handle_left_type = bp.handle_right_type = 'AUTO'
cu.bevel_depth = 0.011; cu.bevel_resolution = 6; cu.resolution_u = 24
hanger = bpy.data.objects.new('hanger', cu); sc.collection.objects.link(hanger)
hanger.scale = (1, 1.9, 1); hanger.location.y = 0  # flattened oval section, wider front to back
hanger.data.materials.append(oak)
# hook
hk = bpy.data.curves.new('hook', 'CURVE'); hk.dimensions = '3D'
s2 = hk.splines.new('BEZIER'); s2.bezier_points.add(3)
pts = [(0, 0, NECK_Z - 0.01), (0, 0, NECK_Z + 0.06), (0.03, 0, NECK_Z + 0.105), (0.055, 0, NECK_Z + 0.075)]
for bp, co in zip(s2.bezier_points, pts):
    bp.co = co; bp.handle_left_type = bp.handle_right_type = 'AUTO'
hk.bevel_depth = 0.0022; hk.bevel_resolution = 4
hook = bpy.data.objects.new('hook', hk); sc.collection.objects.link(hook); hook.data.materials.append(steel)
RAIL_Z = NECK_Z + 0.098

if not os.path.exists(cache):
    # collider: a mesh copy of the hanger, slightly fattened
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    col_me = bpy.data.meshes.new_from_object(hanger.evaluated_get(dg))
    col = bpy.data.objects.new('hanger_col', col_me); sc.collection.objects.link(col); col.matrix_world = hanger.matrix_world
    col.modifiers.new('col', 'COLLISION'); col.collision.thickness_outer = 0.006; col.collision.cloth_friction = float(E('FRIC', '40'))
    cl = tee.modifiers.new('cloth', 'CLOTH'); s = cl.settings
    s.quality = 8; s.mass = 0.004; s.air_damping = 4.0
    s.tension_stiffness = 12; s.compression_stiffness = 12; s.shear_stiffness = 4; s.bending_stiffness = float(E('BEND', '0.12'))
    s.use_sewing_springs = True; s.sewing_force_max = 4.0
    s.use_internal_springs = False
    cl.collision_settings.use_collision = True; cl.collision_settings.distance_min = 0.004
    cl.collision_settings.use_self_collision = True; cl.collision_settings.self_distance_min = 0.003
    cl.point_cache.frame_start = 1; cl.point_cache.frame_end = 400
    sc.frame_start = 1; sc.frame_end = 400
    # sew the panels closed around the hanger first, then let gravity in
    ew = s.effector_weights
    ew.gravity = 0.0; ew.keyframe_insert('gravity', frame=1)
    ew.gravity = 0.0; ew.keyframe_insert('gravity', frame=int(E('SEWF', '18')))
    ew.gravity = 1.0; ew.keyframe_insert('gravity', frame=int(E('SEWF', '18')) + 8)
    import time; T0 = time.time()
    for f in range(1, int(E('SIMF', '110')) + 1):
        sc.frame_set(f)
        if f % 10 == 0: print('frame', f, round(time.time() - T0), flush=True)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = tee.evaluated_get(dg)
    vs = [list(tee.matrix_world @ v.co) for v in ev.data.vertices]
    fs = [list(p.vertices) for p in ev.data.polygons]
    tee.modifiers.remove(cl)
    old = tee.data
    tee.data = bpy.data.meshes.new('tee'); tee.data.from_pydata(vs, [], fs)
    bpy.data.objects.remove(col)
    os.makedirs(C.OUT, exist_ok=True)
    json.dump({'v': vs, 'f': fs, 'r': REST}, open(cache, 'w'))
    sc.frame_set(1)
    print('SIM done', round(time.time() - T0))

# rib collar: a soft tube around the neck opening of the draped tee
import bmesh as _bm
b2 = _bm.new(); b2.from_mesh(tee.data)
ring = [v.co.copy() for v in b2.verts if v.is_boundary and v.co.z > NECK_Z - 0.075 and abs(v.co.x) < 0.11]
b2.free()
if len(ring) > 8:
    cx = sum(p.x for p in ring) / len(ring); cy = sum(p.y for p in ring) / len(ring)
    ring.sort(key=lambda p: math.atan2(p.y - cy, p.x - cx))
    cc = bpy.data.curves.new('collar', 'CURVE'); cc.dimensions = '3D'
    spl = cc.splines.new('NURBS'); spl.points.add(len(ring) - 1)
    for pt, p in zip(spl.points, ring): pt.co = (p.x, p.y, p.z, 1)
    spl.use_cyclic_u = True; spl.order_u = 4
    cc.bevel_depth = 0.0042; cc.bevel_resolution = 4; cc.resolution_u = 6
    collar = bpy.data.objects.new('collar', cc); sc.collection.objects.link(collar)
    COLLAR = collar
else:
    COLLAR = None
# finish the tee: thickness, smooth, jersey
for p in tee.data.polygons: p.use_smooth = True
so = tee.modifiers.new('solid', 'SOLIDIFY'); so.thickness = 0.0022; so.offset = 0
ss = tee.modifiers.new('sub', 'SUBSURF'); ss.levels = 2; ss.render_levels = 2
tee.data.uv_layers.new()
uv = tee.data.uv_layers.active.data
for p in tee.data.polygons:
    for li in p.loop_indices:
        rx, rz = REST[tee.data.loops[li].vertex_index]
        uv[li].uv = (rx * 4.0, rz * 4.0)
jersey = C.texture('cotton_jersey', '2k')
tee_m = C.pbr('tee_jersey', jersey, scale=1.0, color_mult=tuple(float(c) for c in E('TEE', '0.62,0.58,0.52').split(',')),
              hue_sat=(0.5, 0.0, 1.0), rough_mult=0.4, rough_add=0.6, bump=1.0, sheen=0.6)
tee.data.materials.append(tee_m)
if COLLAR: COLLAR.data.materials.append(tee_m)
tee.modifiers.new('wn', 'WEIGHTED_NORMAL') if False else None

# ---------- the room: concrete wall and floor, the rail on two brackets ----------
conc = C.texture('concrete_wall_008', '2k')
wall_m = C.pbr('concrete_wall', conc, scale=1.0, color_mult=(0.42, 0.42, 0.43), hue_sat=(0.5, 0.25, 1.0), rough_mult=1.0, bump=1.0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.75, 1.6)); wall = bpy.context.object; wall.scale = (8, 0.2, 4)
bpy.ops.object.transform_apply(scale=True); C.uv_box(wall, 0.35); wall.data.materials.append(wall_m)
floor_t = C.texture('concrete_floor_02', '2k')
floor_m = C.pbr('concrete_floor', floor_t, scale=1.0, hue_sat=(0.5, 0.3, 1.0), color_mult=(0.35, 0.35, 0.36), rough_mult=0.8, bump=0.8)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -1, 0)); fl = bpy.context.object; fl.scale = (8, 4, 1)
bpy.ops.object.transform_apply(scale=True); C.uv_box(fl, 0.4); fl.data.materials.append(floor_m)
bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=1.6, vertices=32, location=(0.055, 0.0, RAIL_Z + 0.006), rotation=(0, math.radians(90), 0))
rail = bpy.context.object; rail.data.materials.append(steel); C.smooth(rail)
for x in (-0.75, 0.85):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0.33, RAIL_Z + 0.006)); b = bpy.context.object
    b.scale = (0.02, 0.66, 0.02); b.data.materials.append(steel)
# cyan cove line where wall meets floor, far behind the light pool
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.64, 0.012)); cove = bpy.context.object; cove.scale = (6, 0.01, 0.006)
cove.data.materials.append(C.emission('cove_cyan', (0.3, 0.85, 1.0), float(E('COVE', '6'))))

# ---------- light: one hard spot from above the camera, a breath of fill ----------
C.light(sc, 'SPOT', (float(E('SPX', '1.0')), -1.2, 3.3), target=(0.0, 0.0, 1.38), energy=float(E('SPOT', '900')), color=C.kelvin(4300),
        size=0.01, spot=math.radians(float(E('CONE', '21'))), blend=0.08, name='spot')
C.light(sc, 'AREA', (-1.5, -2.0, 1.4), target=(0, 0, 1.4), energy=float(E('FILL', '8')), color=C.kelvin(5200), size=2.0, name='fill')

cam = C.camera(sc, (float(E('CAMX', '0.32')), float(E('CAMY', '-2.7')), float(E('CAMZ', '1.32'))), (0.0, 0.0, 1.39),
               lens=float(E('LENS', '62')), fstop=float(E('FSTOP', '4')))
cam.data.dof.focus_distance = (Vector((0, -0.05, 1.4)) - cam.location).length

C.render(sc, 'drop', SLOT)
