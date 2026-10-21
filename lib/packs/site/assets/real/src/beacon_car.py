# beacon / hero and about: a black car on black lacquer in a dark studio. The hero is a long, low crop along its side,
# the softbox laid along the shoulder as one clean line of light, the front wheel right of centre; the about is a close
# crop of that wheel under its arch: ten split spokes machined bright on a gunmetal face, the drilled disc and the
# caliper behind, the tyre's sidewall and tread. Everything is procedural (no model downloads); no badges, no text.
# Accent colour: a cool cyan floor strip far behind, seen only as a thin line in the paint's lower reflection.
# Usage: SLOT=hero|about python beacon_car.py [--preview]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, bmesh
from mathutils import Vector

E = os.environ.get
SLOT = E('SLOT', 'hero')
W, H = {'hero': (1600, 1000), 'about': (1200, 1400)}[SLOT]
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '96')), exposure=float(E('EXPO', '0')))
C.world_color(sc, (0.0006, 0.0006, 0.0007))


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mesh_obj(name, verts, faces, mat=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if smooth: me.shade_smooth()
    if mat: me.materials.append(mat)
    return o


def loft(name, stations, mat=None, closed=True, caps=True):
    """Skin a list of cross-sections (each a list of points, same count) into a mesh, optionally capped."""
    n = len(stations[0]); verts = [tuple(p) for st in stations for p in st]; faces = []
    for i in range(len(stations) - 1):
        for j in range(n if closed else n - 1):
            a, b = i * n + j, i * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    if caps and closed:
        faces.append(tuple(range(n))[::-1]); faces.append(tuple(range((len(stations) - 1) * n, len(stations) * n)))
    return mesh_obj(name, verts, faces, mat)


# ---------- materials ----------
def paint():
    """Solid black lacquer: near-black base, a hint of metallic, a thick glassy clear coat. Seams, the sill trim and the
    door handle recess are drawn in the same shader from object coordinates, so the gaps follow the surface exactly."""
    m = C.principled('black_lacquer', color=(0.0035, 0.0036, 0.004), rough=0.45, metal=0.0,
                     **{'Coat Weight': 1.0, 'Coat Roughness': float(E('COATR', '0.012')), 'Coat IOR': 1.55, 'Specular IOR Level': 0.15})
    nt = m.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); sp = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs['Vector'])
    gap = None
    for xs in (0.98, -0.12, -1.0):          # front door, B pillar, rear door shut line
        sub = N.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = xs
        L.new(sp.outputs['X'], sub.inputs[0])
        ab = N.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; L.new(sub.outputs[0], ab.inputs[0])
        g = N.new('ShaderNodeMapRange'); g.inputs['From Min'].default_value = 0.0015; g.inputs['From Max'].default_value = 0.0035
        g.inputs['To Min'].default_value = 1.0; g.inputs['To Max'].default_value = 0.0
        L.new(ab.outputs[0], g.inputs['Value'])
        if gap is None: gap = g.outputs['Result']
        else:
            mx = N.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; L.new(gap, mx.inputs[0]); L.new(g.outputs['Result'], mx.inputs[1]); gap = mx.outputs[0]
    # only between the sill and the beltline
    zm = N.new('ShaderNodeMapRange'); zm.inputs['From Min'].default_value = 0.93; zm.inputs['From Max'].default_value = 0.94
    zm.inputs['To Min'].default_value = 1.0; zm.inputs['To Max'].default_value = 0.0; L.new(sp.outputs['Z'], zm.inputs['Value'])
    zl = N.new('ShaderNodeMapRange'); zl.inputs['From Min'].default_value = 0.2; zl.inputs['From Max'].default_value = 0.21
    L.new(sp.outputs['Z'], zl.inputs['Value'])
    m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; L.new(gap, m1.inputs[0]); L.new(zm.outputs['Result'], m1.inputs[1])
    m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; L.new(m1.outputs[0], m2.inputs[0]); L.new(zl.outputs['Result'], m2.inputs[1])
    bm = N.new('ShaderNodeBump'); bm.invert = True; bm.inputs['Strength'].default_value = 1.0; bm.inputs['Distance'].default_value = 0.004
    L.new(m2.outputs[0], bm.inputs['Height']); L.new(bm.outputs['Normal'], b.inputs['Normal']); L.new(bm.outputs['Normal'], b.inputs['Coat Normal'])
    # gaps go matte black, the coat drops out in them
    inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L.new(m2.outputs[0], inv.inputs[1])
    L.new(inv.outputs[0], b.inputs['Coat Weight'])
    # the sill below z 0.2: satin black trim
    rm = N.new('ShaderNodeMapRange'); rm.inputs['From Min'].default_value = 0.2; rm.inputs['From Max'].default_value = 0.205
    rm.inputs['To Min'].default_value = 0.55; rm.inputs['To Max'].default_value = 0.32; L.new(sp.outputs['Z'], rm.inputs['Value'])
    L.new(rm.outputs['Result'], b.inputs['Roughness'])
    return m


lacq = paint()
glass_d = C.principled('tinted_glass', color=(0.002, 0.002, 0.0025), rough=0.02, **{'Specular IOR Level': 0.9})
trim_m = C.principled('satin_black', color=(0.012, 0.012, 0.013), rough=0.45)
chrome = C.principled('bright_trim', color=(0.85, 0.86, 0.88), rough=0.07, metal=1.0)
void = C.principled('void', color=(0, 0, 0), rough=1.0, **{'Specular IOR Level': 0.0})
liner_m = C.principled('arch_liner', color=(0.01, 0.01, 0.01), rough=0.85)
rubber = C.principled('tyre_rubber', color=(0.006, 0.006, 0.0065), rough=0.78, **{'Specular IOR Level': 0.3})
disc_m = C.principled('disc_iron', color=(0.42, 0.42, 0.43), rough=0.35, metal=1.0)
cal_m = C.principled('caliper', color=(0.13, 0.135, 0.14), rough=0.35, metal=0.3, **{'Coat Weight': 0.6, 'Coat Roughness': 0.08})


def wheel_alloy():
    """Two-tone alloy: machined bright where the face looks outward (+z local), gunmetal paint elsewhere."""
    m = C.principled('alloy', color=(0.08, 0.085, 0.09), rough=0.3, metal=1.0, **{'Coat Weight': 0.5, 'Coat Roughness': 0.05})
    nt = m.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
    geo = N.new('ShaderNodeNewGeometry')
    vt = N.new('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'OBJECT'
    L.new(geo.outputs['Normal'], vt.inputs['Vector'])
    sp = N.new('ShaderNodeSeparateXYZ'); L.new(vt.outputs['Vector'], sp.inputs['Vector'])
    mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.8; mr.inputs['From Max'].default_value = 0.9
    L.new(sp.outputs['Z'], mr.inputs['Value'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    a_, b_ = [s for s in mix.inputs if s.type == 'RGBA'][:2]
    a_.default_value = (0.08, 0.085, 0.09, 1); b_.default_value = (0.82, 0.83, 0.85, 1)
    L.new(mr.outputs['Result'], mix.inputs[0]); L.new([s for s in mix.outputs if s.type == 'RGBA'][0], b.inputs['Base Color'])
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.3; rr.inputs['To Max'].default_value = 0.12
    L.new(mr.outputs['Result'], rr.inputs['Value']); L.new(rr.outputs['Result'], b.inputs['Roughness'])
    return m


alloy = wheel_alloy()

# ---------- body: one side skin + its top, generated from a section and a plan ----------
HW = 0.93                     # half width
X0, X1 = -2.42, 2.42          # body length
WB = 1.44                     # wheel centres at +-WB
WR = 0.345                    # wheel radius
ARCH = 0.392


def halfwidth(x):
    t = abs(x) / (X1 + 0.02)
    return HW * (1 - t ** 7) ** 0.5


def belt(x):
    return 0.95 - 0.16 * smoothstep(1.25, 2.42, x) - 0.06 * smoothstep(1.7, 2.42, -x)


def section(z, zt):
    """Side curvature: tucked sill, full at the door, a crisp shoulder just under the belt, tumblehome above."""
    v = (z - 0.16) / (zt - 0.16)
    s = 0.95 + 0.05 * smoothstep(0.0, 0.32, v) - 0.012 * smoothstep(0.82, 0.86, v) - 0.035 * smoothstep(0.86, 1.0, v)
    return s


NX, NZ, NT = int(E('NX', '320')), 48, 18
verts, faces, idx = [], [], {}
for i in range(NX + 1):
    x = X0 + (X1 - X0) * i / NX
    zt = belt(x); hw = halfwidth(x)
    for k in range(NZ + 1):
        z = 0.16 + (zt - 0.16) * k / NZ
        verts.append((x, -hw * section(z, zt), z))
    for k in range(1, NT + 1):           # over the top toward the centre line, slight crown
        t = k / NT
        verts.append((x, -hw * section(zt, zt) * (1 - smoothstep(0, 1, t) ** 1.2), zt + 0.035 * math.sin(t * math.pi / 2)))
NC = NZ + 1 + NT
for i in range(NX):
    for k in range(NC - 1):
        a = i * NC + k
        faces.append((a, a + NC, a + NC + 1, a + 1))
body = mesh_obj('body', verts, faces, lacq)
# cut the wheel arches: drop faces whose centre is inside the arch circle, snap the boundary onto it
bm = bmesh.new(); bm.from_mesh(body.data)
kill = []
for f in bm.faces:
    c = f.calc_center_median()
    for wx in (-WB, WB):
        if (c.x - wx) ** 2 + (c.z - WR) ** 2 < ARCH ** 2 and c.z < 0.8:
            kill.append(f); break
bmesh.ops.delete(bm, geom=kill, context='FACES')
for v in bm.verts:
    if v.is_boundary:
        for wx in (-WB, WB):
            d = Vector((v.co.x - wx, v.co.z - WR))
            if d.length < ARCH + 0.03 and v.co.z > 0.161:
                d.normalize(); v.co.x = wx + d.x * ARCH; v.co.z = WR + d.y * ARCH
bm.to_mesh(body.data); bm.free(); body.data.update()
so = body.modifiers.new('solid', 'SOLIDIFY'); so.thickness = 0.004; so.offset = 1.0
ss = body.modifiers.new('sub', 'SUBSURF'); ss.levels = 1; ss.render_levels = 1

# arch lips: a slightly flared rolled edge
for wx in (-WB, WB):
    st = []
    for j in range(41):
        a = math.radians(-8 + 196 * j / 40)
        r = ARCH + 0.004
        cx, cz = wx + math.cos(a) * r, WR + math.sin(a) * r
        if cz < 0.16: cz = 0.16
        yv = -halfwidth(cx) * section(cz, belt(cx))
        st.append([(cx + math.cos(a) * dr, yv + dy, cz + math.sin(a) * dr) for dr, dy in ((0, -0.002), (0.012, -0.006), (0.012, 0.02), (0, 0.02))])
    loft('arch_lip', st, lacq)
    # liner: black plastic tunnel over the wheel
    st = []
    for j in range(41):
        a = math.radians(-10 + 200 * j / 40)
        st.append([(wx + math.cos(a) * (ARCH + 0.004), y, WR + math.sin(a) * (ARCH + 0.004)) for y in (-0.92, -0.45)])
    loft('liner', st, liner_m, closed=False, caps=False)

# glasshouse: side glass leaning in, a black B pillar, roof, a bright trim along the belt
GX0, GX1 = -1.32, 1.0
st = []
for i in range(41):
    t = i / 40
    sec = []
    for k in range(9):
        u = k / 8
        z = 0.97 + 0.43 * u
        xa = GX0 + 0.55 * smoothstep(0, 1, u) ** 0.8         # C pillar rake
        xb = GX1 - 0.8 * u ** 0.9                              # A pillar rake
        x = xa + (xb - xa) * t
        y = -(halfwidth(x) * 0.93 - 0.2 * u ** 1.4)
        sec.append((x, y, z))
    st.append(sec)
gv, gf = [], []
for s in st: gv += s
for i in range(40):
    for k in range(8):
        a = i * 9 + k; gf.append((a, a + 9, a + 10, a + 1))
mesh_obj('side_glass', gv, gf, glass_d)
roof = [(s[-1][0], s[-1][1], s[-1][2]) for s in st]
rv = roof + [(p[0], 0.0, p[2] + 0.06) for p in roof]
mesh_obj('roof', rv, [(i, i + 1, 41 + i + 1, 41 + i) for i in range(40)], lacq)
for i, (x0, x1) in enumerate(((-0.17, -0.07),)):
    pv = []
    for u in (0.0, 1.0):
        z = 0.97 + 0.43 * u
        for x in (x0 - 0.04 * u, x1 - 0.04 * u):
            pv.append((x, -(halfwidth(x) * 0.93 - 0.2 * u ** 1.4) - 0.004, z))
    mesh_obj('b_pillar', pv, [(0, 1, 3, 2)], trim_m)
belt_pts = [(x, -halfwidth(x) * section(belt(x), belt(x)) - 0.002, belt(x) + 0.012) for x in [GX0 + (GX1 - GX0) * i / 60 for i in range(61)]]
cu = bpy.data.curves.new('belt', 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(belt_pts) - 1)
for p, q in zip(sp.points, belt_pts): p.co = (*q, 1)
cu.bevel_depth = 0.006; cu.bevel_resolution = 3
o = bpy.data.objects.new('belt_trim', cu); sc.collection.objects.link(o); o.data.materials.append(chrome)
# flush door handles
for hx in (0.62, -0.42):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(hx, -halfwidth(hx) * section(0.83, belt(hx)) - 0.003, 0.83))
    hd = bpy.context.object; hd.scale = (0.2, 0.012, 0.028)
    bv = hd.modifiers.new('bev', 'BEVEL'); bv.width = 0.008; bv.segments = 4; hd.data.materials.append(lacq)
# underbody and cabin blockers so no light leaks through the open model
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.42)); ub = bpy.context.object; ub.scale = (3.9, 1.45, 0.36); ub.data.materials.append(void)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.15, 0, 1.08)); cb = bpy.context.object; cb.scale = (1.7, 1.05, 0.3); cb.data.materials.append(void)


# ---------- wheels ----------
def wheel(wx):
    WY = -HW + 0.03 + 0.125
    root = bpy.data.objects.new('wheel', None); sc.collection.objects.link(root)
    parts = []
    # tyre 245/40 R19
    prof = [(0.243, -0.104), (0.262, -0.116), (0.3, -0.122), (0.328, -0.118), (0.34, -0.1), (0.3445, -0.06), (0.345, 0.0),
            (0.3445, 0.06), (0.34, 0.1), (0.328, 0.118), (0.3, 0.122), (0.262, 0.116), (0.243, 0.104)]
    ty = C.lathe('tyre', prof, (0, 0, 0), None, steps=160, sub=1); parts.append(ty)
    tm = rubber.copy(); ty.data.materials.append(tm)
    nt = tm.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); sp = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs['Vector'])
    # tread grooves (circumferential) only on the crown
    wv = N.new('ShaderNodeTexWave'); wv.bands_direction = 'Z'; wv.inputs['Scale'].default_value = 2.2; wv.wave_profile = 'SAW'
    L.new(tc.outputs['Object'], wv.inputs['Vector'])
    ln = N.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    cm = N.new('ShaderNodeCombineXYZ'); L.new(sp.outputs['X'], cm.inputs['X']); L.new(sp.outputs['Y'], cm.inputs['Y']); L.new(cm.outputs['Vector'], ln.inputs[0])
    crown = N.new('ShaderNodeMapRange'); crown.inputs['From Min'].default_value = 0.338; crown.inputs['From Max'].default_value = 0.341
    L.new(ln.outputs['Value'], crown.inputs['Value'])
    gr = N.new('ShaderNodeMapRange'); gr.inputs['From Min'].default_value = 0.9; gr.inputs['From Max'].default_value = 0.95
    L.new(wv.outputs['Fac'], gr.inputs['Value'])
    mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; L.new(gr.outputs['Result'], mm.inputs[0]); L.new(crown.outputs['Result'], mm.inputs[1])
    bp = N.new('ShaderNodeBump'); bp.invert = True; bp.inputs['Distance'].default_value = 0.006; L.new(mm.outputs[0], bp.inputs['Height'])
    ns = N.new('ShaderNodeTexNoise'); ns.inputs['Scale'].default_value = 600; ns.inputs['Detail'].default_value = 6; bp2 = N.new('ShaderNodeBump'); bp2.inputs['Strength'].default_value = 0.25
    L.new(ns.outputs['Fac'], bp2.inputs['Height']); L.new(bp.outputs['Normal'], bp2.inputs['Normal']); L.new(bp2.outputs['Normal'], b.inputs['Normal'])
    # rim lip and barrel
    rim = C.lathe('rim', [(0.205, -0.1), (0.236, -0.104), (0.236, 0.095), (0.244, 0.106), (0.25, 0.114), (0.246, 0.12), (0.236, 0.118), (0.228, 0.106)],
                  (0, 0, 0), alloy, steps=160, sub=1); parts.append(rim)
    # ten split spokes, dished: hub sits deeper than the lip
    for k in range(5):
        for o_ in (-0.12, 0.12):
            a = math.radians(90 + k * 72) + o_
            st = []
            for j in range(13):
                t = j / 12; r = 0.062 + (0.232 - 0.062) * t
                w = 0.04 - 0.012 * t + 0.012 * (t ** 6)
                zf = 0.07 + 0.042 * t ** 0.7; th = 0.03 - 0.008 * t
                aa = a - o_ * 0.55 * (1 - t)  # the pair converges at the hub
                c, s = math.cos(aa), math.sin(aa)
                tx, tyy = -s, c
                st.append([(c * r + tx * w / 2, s * r + tyy * w / 2, zf), (c * r - tx * w / 2, s * r - tyy * w / 2, zf),
                           (c * r - tx * w * 0.42, s * r - tyy * w * 0.42, zf - th), (c * r + tx * w * 0.42, s * r + tyy * w * 0.42, zf - th)])
            spk = loft('spoke', st, alloy)
            bv = spk.modifiers.new('bev', 'BEVEL'); bv.width = 0.002; bv.segments = 2; bv.limit_method = 'ANGLE'
            parts.append(spk)
    hub = C.lathe('hub', [(0.0, 0.085), (0.04, 0.085), (0.05, 0.08), (0.075, 0.07), (0.075, 0.02)], (0, 0, 0), alloy, steps=96, sub=1); parts.append(hub)
    cap = C.lathe('cap', [(0.0, 0.093), (0.024, 0.092), (0.03, 0.088), (0.031, 0.08)], (0, 0, 0), C.principled('cap', color=(0.02, 0.02, 0.022), rough=0.2, **{'Coat Weight': 1.0}), steps=64, sub=1); parts.append(cap)
    for k in range(5):
        a = math.radians(54 + k * 72)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.0095, depth=0.02, vertices=6, location=(math.cos(a) * 0.052, math.sin(a) * 0.052, 0.088))
        n_ = bpy.context.object; n_.data.materials.append(chrome); bv = n_.modifiers.new('bev', 'BEVEL'); bv.width = 0.002; bv.segments = 2; parts.append(n_)
    # brake disc (drilled) and caliper
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.028, vertices=128, location=(0, 0, -0.01)); dk = bpy.context.object; parts.append(dk)
    dm = disc_m.copy(); dk.data.materials.append(dm)
    nt = dm.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 28; vor.feature = 'F1'; vor.distance = 'EUCLIDEAN'
    L.new(tc.outputs['Object'], vor.inputs['Vector'])
    hole = N.new('ShaderNodeMapRange'); hole.inputs['From Min'].default_value = 0.11; hole.inputs['From Max'].default_value = 0.14
    hole.inputs['To Min'].default_value = 0.0; hole.inputs['To Max'].default_value = 1.0; L.new(vor.outputs['Distance'], hole.inputs['Value'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    a_, b_ = [s for s in mx.inputs if s.type == 'RGBA'][:2]; a_.default_value = (0.005, 0.005, 0.005, 1); b_.default_value = (0.42, 0.42, 0.43, 1)
    L.new(hole.outputs['Result'], mx.inputs[0]); L.new([s for s in mx.outputs if s.type == 'RGBA'][0], b.inputs['Base Color'])
    st = []
    for j in range(17):
        a = math.radians(100 + 62 * j / 16)
        c, s = math.cos(a), math.sin(a)
        st.append([(c * r, s * r, z) for r, z in ((0.13, 0.03), (0.212, 0.03), (0.212, -0.06), (0.13, -0.06))])
    cal = loft('caliper', st, cal_m); bv = cal.modifiers.new('bev', 'BEVEL'); bv.width = 0.008; bv.segments = 3; parts.append(cal)
    for p in parts:
        p.parent = root
    root.rotation_euler = (math.radians(90), 0, 0)
    root.location = (wx, WY, WR - 0.004)   # a touch of load on the contact patch
    return root


wheel(-WB); wheel(WB)

# ---------- studio: black lacquer floor, long softbox, low strip, a cool line far behind ----------
fl = C.principled('floor_lacquer', color=(0.004, 0.004, 0.0045), rough=0.12, **{'Coat Weight': 1.0, 'Coat Roughness': 0.03})
nt = fl.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
ns = N.new('ShaderNodeTexNoise'); ns.inputs['Scale'].default_value = 0.6; ns.inputs['Detail'].default_value = 4
rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.06; rr.inputs['To Max'].default_value = 0.16
L.new(ns.outputs['Fac'], rr.inputs['Value']); L.new(rr.outputs['Result'], b.inputs['Coat Roughness'])
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); bpy.context.object.data.materials.append(fl)

C.light(sc, 'AREA', (float(E('SBX', '-0.3')), float(E('SBY', '-2.6')), float(E('SBZ', '3.0'))), target=(-0.3, -0.9, 0.9),
        energy=float(E('SOFT', '450')), color=C.kelvin(5600), size=7.0, size_y=0.45, shape='RECTANGLE', name='softbox')
C.light(sc, 'AREA', (-0.6, -4.5, 0.45), target=(-0.6, 0, 0.35), energy=float(E('LOW', '1.5')), color=C.kelvin(5200), size=6.0,
        size_y=0.12, shape='RECTANGLE', name='lowstrip')
C.light(sc, 'AREA', (-3.8, 0.8, 1.6), target=(-1.4, -0.8, 0.5), energy=float(E('KICK', '160')), color=C.kelvin(4800), size=1.2, name='kick')
if SLOT == 'about':   # a small fill for the spoke faces; in the hero its reflection would sit on the door as a grey square
    C.light(sc, 'AREA', (0.9, -3.2, 0.3), target=(WB, -0.8, 0.35), energy=float(E('WFILL', '5')), color=C.kelvin(5000), size=0.9, name='wheel_fill')
# the quiet colour: a cyan floor strip way behind the camera's left, picked up in the lower door
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.5, -7.0, 0.05)); cs = bpy.context.object; cs.scale = (6.0, 0.03, 0.03)
cs.data.materials.append(C.emission('cyan_strip', (0.25, 0.85, 1.0), float(E('CYAN', '6'))))

if SLOT == 'hero':
    cam = C.camera(sc, (float(E('CX', '-1.5')), float(E('CY', '-5.4')), float(E('CZ', '0.45'))), (float(E('TX', '0.3')), -0.85, float(E('TZ', '0.48'))),
                   lens=float(E('LENS', '64')), fstop=float(E('FSTOP', '4')))
    cam.data.dof.focus_distance = (Vector((WB, -0.85, 0.4)) - cam.location).length
else:
    cam = C.camera(sc, (float(E('CX', '0.55')), float(E('CY', '-3.1')), float(E('CZ', '0.48'))), (WB - 0.02, -0.85, float(E('TZ', '0.42'))),
                   lens=float(E('LENS', '85')), fstop=float(E('FSTOP', '4')))
    cam.data.dof.focus_distance = (Vector((WB, -0.8, 0.36)) - cam.location).length
C.render(sc, 'beacon', SLOT)
