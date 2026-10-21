# A tee pattern (front and back panels on a grid, boundaries snapped to the outline) and a retail fold of it, shared
# by the drop scenes. Units are metres; the pattern's x runs across the chest, its z runs down from the neck point.
import math, random
import bpy, bmesh
from mathutils import Vector, noise

HALF = [(0.0, -0.06), (0.05, -0.045), (0.085, -0.012), (0.095, 0.0), (0.25, -0.045), (0.405, -0.175), (0.335, -0.275),
        (0.258, -0.245), (0.262, -0.72), (0.0, -0.72)]
FRONT = HALF + [(-x, z) for x, z in reversed(HALF[1:-1])]
BACK_HALF = [(0.0, -0.018), (0.06, -0.012), (0.095, 0.0)] + HALF[4:]
BACK = BACK_HALF + [(-x, z) for x, z in reversed(BACK_HALF[1:-1])]


def inside(p, poly):
    x, z = p; c = False
    for i in range(len(poly)):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c


def closest(p, poly):
    best, bd = None, 1e9
    for i in range(len(poly)):
        a = Vector(poly[i]); b = Vector(poly[(i + 1) % len(poly)])
        ab = b - a; t = max(0, min(1, (Vector(p) - a).dot(ab) / ab.length_squared))
        q = a + ab * t; d = (Vector(p) - q).length
        if d < bd: bd, best = d, q
    return best


def folded_tee(name, step=0.008, gap=0.0035, scale=1.0, seed=0, sleeve_fold=0.118, hem_fold=-0.37):
    """A tee laid face up and folded the shop way: sides and sleeves under, then the lower half under. Returns an
    object whose layers are stacked by `gap`; fold edges are the faces stretched between layers."""
    rng = random.Random(seed)
    bm = bmesh.new()
    neck = []
    xs = [i * step for i in range(int(-0.43 / step) - 1, int(0.43 / step) + 2)]
    zs = [-j * step for j in range(-1, int(0.74 / step) + 2)]
    for poly, h in ((FRONT, gap), (BACK, 0.0)):
        quads = []
        for i in range(len(xs) - 1):
            for j in range(len(zs) - 1):
                if inside((xs[i] + step / 2, zs[j] - step / 2), poly):
                    quads.append([(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)])
        used = {k for q in quads for k in q}
        vm = {k: bm.verts.new((xs[k[0]], zs[k[1]], h)) for k in used}
        for q in quads:
            bm.faces.new([vm[k] for k in q])
        for k, v in vm.items():
            if v.is_boundary:
                q = closest((v.co.x, v.co.y), poly)
                v.co.x, v.co.y = q.x, q.y
                if abs(q.x) < 0.094 and q.y > -0.065:
                    neck.append(v)
    # fold: sleeves tucked back first, then sides under (each layer reflected across the fold line and dropped
    # below), then the bottom under
    for v in bm.verts:
        x, y, z = v.co
        if abs(x) > 0.21:
            x = math.copysign(0.42 - abs(x), x)
            z = -z - gap * 0.8
        v.co = Vector((x, y, z))
    for v in bm.verts:
        x, y, z = v.co
        if abs(x) > sleeve_fold:
            x = math.copysign(2 * sleeve_fold - abs(x), x)
            z = -z - gap * 3.2
        v.co = Vector((x, y, z))
    for v in bm.verts:
        x, y, z = v.co
        if y < hem_fold:
            y = 2 * hem_fold - y
            z = -z - gap * 10.0
        v.co = Vector((x, y, z))
    # soften: plush top, wandering edges, a few creases
    zmax = max(v.co.z for v in bm.verts)
    off = Vector((seed * 5.1, seed * 2.3, 0))
    for v in bm.verts:
        q = Vector((v.co.x * 12, v.co.y * 12, 0)) + off
        topness = 1.0 if v.co.z > zmax - 1e-4 else 0.35
        cx = (v.co.x / sleeve_fold); cy = (v.co.y - hem_fold * 0.5) / (abs(hem_fold) * 0.5)
        pillow = max(0.0, 1 - cx * cx) * max(0.0, 1 - cy * cy)
        v.co.z += topness * (pillow * gap * 2.0 + noise.fractal(q, 1.0, 2.0, 5) * 0.0035 + (1 - abs(noise.noise(q * 1.9))) ** 6 * 0.0022 - (1 - abs(noise.noise(q * 3.1 + Vector((9, 0, 0))))) ** 10 * 0.0015)
        v.co.x += noise.noise(q * 0.7 + Vector((0, 0, 1))) * 0.0025
        v.co.y += noise.noise(q * 0.7 + Vector((0, 0, 2))) * 0.0025
    for v in bm.verts:
        v.co *= scale
    neck_pts = [v.co.copy() for v in neck]
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o['neck'] = [list(p) for p in neck_pts]
    for p in me.polygons: p.use_smooth = True
    so = o.modifiers.new('solid', 'SOLIDIFY'); so.thickness = gap * 0.7 * scale; so.offset = 0
    ss = o.modifiers.new('sub', 'SUBSURF'); ss.levels = 2; ss.render_levels = 2
    me.uv_layers.new()
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (co.x * 4.0, co.y * 4.0)
    return o, -min(v.co.z for v in me.vertices)
