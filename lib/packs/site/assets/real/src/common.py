# Shared helpers for the scene scripts: Poly Haven downloads (CC0), PBR materials, Cycles setup, output.
# Run a scene with Blender 5.1's bpy module:  python src/<design>_<slot>.py [--preview]
# Downloads go to $REAL_DL (default: a scratch folder), never into the repo.
import bpy, os, sys, json, math, urllib.request, subprocess

DL = os.environ.get('REAL_DL', '/tmp/real-dl')
OUT = os.environ.get('REAL_OUT', '/tmp/real-out')
REPO_REAL = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PREVIEW = '--preview' in sys.argv
USED = []  # (kind, id) of every Poly Haven asset a scene pulls in


def _get(url, dest):
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        tmp = dest + '.part'
        req = urllib.request.Request(url, headers={'User-Agent': '127-site-renders/1.0 (CC0 asset fetch)'})
        with urllib.request.urlopen(req) as r, open(tmp, 'wb') as f:
            f.write(r.read())
        os.replace(tmp, dest)
    return dest


def _files(asset):
    p = os.path.join(DL, 'meta', asset + '.json')
    _get(f'https://api.polyhaven.com/files/{asset}', p)
    return json.load(open(p))


def hdri(asset, res='2k'):
    USED.append(('hdri', asset))
    f = _files(asset)['hdri'][res]['hdr']
    return _get(f['url'], os.path.join(DL, 'hdri', os.path.basename(f['url'])))


def texture(asset, res='2k', maps=('Diffuse', 'Rough', 'nor_gl', 'Displacement', 'arm', 'Metal')):
    """Returns {map: path} for the maps Poly Haven has."""
    USED.append(('texture', asset))
    f = _files(asset)
    out = {}
    for m in maps:
        if m in f and res in f[m]:
            fmt = 'jpg' if 'jpg' in f[m][res] else ('png' if 'png' in f[m][res] else 'exr')
            u = f[m][res][fmt]['url']
            out[m] = _get(u, os.path.join(DL, 'tex', asset, os.path.basename(u)))
    return out


def model(asset, res='1k'):
    """Imports a Poly Haven glTF model, returns the new objects."""
    USED.append(('model', asset))
    g = _files(asset)['gltf'][res]['gltf']
    base = os.path.join(DL, 'models', asset, res)
    main = _get(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, inc in g.get('include', {}).items():
        _get(inc['url'], os.path.join(base, rel))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=main)
    return [o for o in bpy.data.objects if o not in before]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def setup(sc, w, h, samples=256, look='AgX - Medium High Contrast', exposure=0.0, pct=100):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24 if PREVIEW else samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02 if PREVIEW else 0.008
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 12
    sc.cycles.glossy_bounces = 6
    sc.cycles.transmission_bounces = 12
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.volume_bounces = 1
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 50 if PREVIEW else pct
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = look
    except TypeError:
        pass
    sc.view_settings.exposure = exposure
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '16'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True


def world_hdri(sc, path, strength=1.0, rot=0.0, visible=True):
    nt = sc.world.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value[2] = rot
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(path)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    if visible:
        nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    else:
        lp = nt.nodes.new('ShaderNodeLightPath')
        mix = nt.nodes.new('ShaderNodeMixShader')
        dark = nt.nodes.new('ShaderNodeBackground')
        dark.inputs['Color'].default_value = (0, 0, 0, 1)
        nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
        nt.links.new(bg.outputs['Background'], mix.inputs[1])
        nt.links.new(dark.outputs['Background'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return nt


def world_color(sc, rgb=(0, 0, 0), strength=1.0):
    nt = sc.world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (*rgb, 1)
    bg.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def world_fog(sc, density=0.01, color=(1, 1, 1), anisotropy=0.3):
    """Thin haze filling the scene (world volume)."""
    nt = sc.world.node_tree
    out = [n for n in nt.nodes if n.type == 'OUTPUT_WORLD'][0]
    v = nt.nodes.new('ShaderNodeVolumePrincipled') if False else nt.nodes.new('ShaderNodeVolumeScatter')
    v.inputs['Density'].default_value = density
    v.inputs['Color'].default_value = (*color, 1)
    v.inputs['Anisotropy'].default_value = anisotropy
    nt.links.new(v.outputs['Volume'], out.inputs['Volume'])


def fog_box(loc, size, density=0.02, color=(1, 1, 1), anisotropy=0.4, noise=0.0):
    """Haze in a box (a world volume would also swallow the background)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = size
    o.name = 'haze'
    m = bpy.data.materials.new('haze')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    N.remove(N['Principled BSDF'])
    v = N.new('ShaderNodeVolumeScatter')
    v.inputs['Color'].default_value = (*color, 1)
    v.inputs['Anisotropy'].default_value = anisotropy
    if noise:
        n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = noise; n.inputs['Detail'].default_value = 3
        r = N.new('ShaderNodeMapRange'); r.inputs['To Min'].default_value = density * 0.2; r.inputs['To Max'].default_value = density * 1.8
        L.new(n.outputs['Fac'], r.inputs['Value']); L.new(r.outputs['Result'], v.inputs['Density'])
    else:
        v.inputs['Density'].default_value = density
    L.new(v.outputs['Volume'], N['Material Output'].inputs['Volume'])
    o.data.materials.append(m)
    o.visible_shadow = False
    return o


def kelvin(k):
    """Rough blackbody RGB for light colours."""
    t = k / 100
    r = 1.0 if t <= 66 else min(1, max(0, 1.2929 * (t - 60) ** -0.1332))
    g = (0.3901 * math.log(t) - 0.6318) if t <= 66 else 1.1298 * (t - 60) ** -0.0755
    b = 1.0 if t >= 66 else (0 if t <= 19 else 0.5432 * math.log(t - 10) - 1.1962)
    return (r, min(1, max(0, g)), min(1, max(0, b)))


def city_material(name='city', strength=6.0, cols=90, rows=46, horizon=0.62, seed=0.0):
    """A night skyline for a plane far out of focus: dark towers, scattered lit windows in warm and cool white, a
    haze band at the horizon. Adapted from 127's brand/v2/hyperreal scene.py. No people, unlike a street HDRI."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    N = nt.nodes.new
    L = nt.links.new
    tc = N('ShaderNodeTexCoord'); sep = N('ShaderNodeSeparateXYZ'); L(tc.outputs['UV'], sep.inputs[0])

    def op(o, a, b=None):
        n = N('ShaderNodeMath'); n.operation = o
        if isinstance(a, float): n.inputs[0].default_value = a
        else: L(a, n.inputs[0])
        if b is not None:
            if isinstance(b, float): n.inputs[1].default_value = b
            else: L(b, n.inputs[1])
        return n.outputs[0]

    def rnd(x, y, s):
        cx = N('ShaderNodeCombineXYZ'); L(x, cx.inputs[0])
        if y is not None: L(y, cx.inputs[1])
        cx.inputs[2].default_value = s + seed
        w = N('ShaderNodeTexWhiteNoise'); w.noise_dimensions = '3D'; L(cx.outputs[0], w.inputs['Vector'])
        return w.outputs['Value']

    X, Y = sep.outputs[0], sep.outputs[1]
    colid = op('FLOOR', op('MULTIPLY', X, float(cols)))
    roof = op('ADD', op('MULTIPLY', rnd(colid, None, 1.0), 0.22), horizon - 0.12)
    inside = op('LESS_THAN', Y, roof)
    gx = op('MULTIPLY', X, float(cols * 5)); gy = op('MULTIPLY', Y, float(rows * 3))
    cell = op('MULTIPLY', op('LESS_THAN', op('FRACT', gx), 0.62), op('LESS_THAN', op('FRACT', gy), 0.55))
    lit = op('GREATER_THAN', rnd(op('FLOOR', gx), op('FLOOR', gy), 3.0), 0.72)
    win = op('MULTIPLY', op('MULTIPLY', cell, lit), inside)
    low = op('POWER', op('SUBTRACT', 1.0, op('MINIMUM', op('DIVIDE', Y, horizon), 1.0)), 2.0)
    warmth = rnd(op('FLOOR', gx), op('FLOOR', gy), 7.0)
    mixc = N('ShaderNodeMix'); mixc.data_type = 'RGBA'
    mixc.inputs['A'].default_value = (*kelvin(3000), 1); mixc.inputs['B'].default_value = (0.75, 0.82, 1.0, 1)
    L(warmth, mixc.inputs['Factor'])
    em1 = N('ShaderNodeEmission'); L(mixc.outputs['Result'], em1.inputs['Color']); L(op('MULTIPLY', win, strength), em1.inputs['Strength'])
    hz = op('MULTIPLY', op('POWER', op('SUBTRACT', 1.0, op('MINIMUM', op('ABSOLUTE', op('SUBTRACT', Y, horizon)), 1.0)), 30.0), 0.35)
    em2 = N('ShaderNodeEmission'); em2.inputs['Color'].default_value = (0.32, 0.36, 0.55, 1)
    L(op('ADD', op('ADD', hz, op('MULTIPLY', inside, 0.004)), op('MULTIPLY', low, 0.25)), em2.inputs['Strength'])
    add = N('ShaderNodeAddShader'); L(em1.outputs[0], add.inputs[0]); L(em2.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs[0])
    return m


def city_plane(y=70, z=-2, w=260, h=70, **kw):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y, z), rotation=(math.radians(90), 0, 0))
    p = bpy.context.object
    p.scale = (w, h, 1)
    p.data.materials.append(city_material(**kw))
    return p


def bokeh_field(cam_loc, n=160, az=(-16, 16), el=(-4.5, 1.5), dist=(25, 250), strength=(15, 70), seed=1,
                temps=(2600, 4200), cool=0.15, rad=0.0025):
    """Sparse far lights (windows, streets) that a shallow lens turns into clean discs. Angles in degrees from the
    camera, looking along +Y. rad: angular radius in radians."""
    import random
    rng = random.Random(seed)
    mats = {}
    for i in range(n):
        a = math.radians(rng.uniform(*az)); e = math.radians(rng.uniform(*el)); d = rng.uniform(*dist)
        x = cam_loc[0] + d * math.sin(a); y = cam_loc[1] + d * math.cos(a); z = cam_loc[2] + d * math.tan(e)
        k = round(rng.uniform(*temps), -2) if rng.random() > cool else 7000
        s = round(rng.uniform(*strength), 2)
        key = (k, s)
        if key not in mats:
            mats[key] = emission(f'bokeh_{k}_{s}', kelvin(k), s)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=d * rad * rng.uniform(0.6, 1.4), location=(x, y, z))
        o = bpy.context.object
        o.data.materials.append(mats[key])
        o.visible_shadow = False
        o.visible_diffuse = False


def glare(sc, kind='Fog Glow', threshold=4.0, strength=0.25, size=0.5, quality='High'):
    """Gentle lens halation on the brightest lights only (compositor glare), never streaks or flares."""
    g = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
    g.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = g.nodes.new('CompositorNodeRLayers')
    gl = g.nodes.new('CompositorNodeGlare')
    for k, v in (('Type', kind), ('Quality', quality), ('Threshold', threshold), ('Strength', strength), ('Size', size)):
        try:
            gl.inputs[k].default_value = v
        except Exception as e:
            print('glare input', k, e)
    out = g.nodes.new('NodeGroupOutput')
    g.links.new(rl.outputs['Image'], gl.inputs['Image'])
    g.links.new(gl.outputs['Image'], out.inputs[0])
    sc.compositing_node_group = g
    sc.render.use_compositing = True


def uv_box(o, scale=1.0):
    """Box-projected UVs in metres (x scale), so tiling textures keep real size on any box."""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new()
    uv = me.uv_layers.active.data
    mw = o.matrix_world
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            v = mw @ me.vertices[me.loops[li].vertex_index].co
            a, b = [(v.y, v.z), (v.x, v.z), (v.x, v.y)][ax]
            uv[li].uv = (a * scale, b * scale)


def lathe(name, prof, loc=(0, 0, 0), mat=None, steps=96, sub=1, thick=0.0):
    """Revolve an (r, z) profile around Z."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(r, 0, z) for r, z in prof], [(i, i + 1) for i in range(len(prof) - 1)], [])
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    sw = o.modifiers.new('screw', 'SCREW'); sw.steps = steps; sw.render_steps = steps
    sw.use_merge_vertices = True; sw.use_normal_calculate = True
    if thick:
        so = o.modifiers.new('solid', 'SOLIDIFY'); so.thickness = thick
    if sub:
        ss = o.modifiers.new('sub', 'SUBSURF'); ss.levels = sub; ss.render_levels = sub
    for p in me.polygons:
        p.use_smooth = True
    if mat:
        me.materials.append(mat)
    return o


def obj_random_color(m, spread=0.25):
    """Varies a material's base colour per object (Object Info random), like real batches of beans or stones."""
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    hs = nt.nodes.new('ShaderNodeHueSaturation')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = 1 - spread; mr.inputs['To Max'].default_value = 1 + spread
    nt.links.new(oi.outputs['Random'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], hs.inputs['Value'])
    src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    if src:
        nt.links.new(src, hs.inputs['Color'])
    else:
        hs.inputs['Color'].default_value = b.inputs['Base Color'].default_value
    nt.links.new(hs.outputs['Color'], b.inputs['Base Color'])


def pbr(name, maps, scale=1.0, color_mult=None, rough_mult=1.0, rough_add=0.0, bump=1.0, disp=None, coat=0.0,
        coat_rough=0.05, hue_sat=None, rot=0.0, metal=None, sheen=0.0):
    """Principled material from a Poly Haven map set. disp: displacement scale in metres (needs adaptive or a dense mesh)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N = nt.nodes
    L = nt.links
    bs = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, scale)
    mp.inputs['Rotation'].default_value[2] = rot
    L.new(tc.outputs['UV'], mp.inputs['Vector'])

    def img(path, non_color):
        t = N.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            t.image.colorspace_settings.name = 'Non-Color'
        L.new(mp.outputs['Vector'], t.inputs['Vector'])
        return t

    if 'Diffuse' in maps:
        d = img(maps['Diffuse'], False)
        col = d.outputs['Color']
        if hue_sat:
            hs = N.new('ShaderNodeHueSaturation')
            hs.inputs['Hue'].default_value, hs.inputs['Saturation'].default_value, hs.inputs['Value'].default_value = hue_sat
            L.new(col, hs.inputs['Color'])
            col = hs.outputs['Color']
        if color_mult:
            mm = N.new('ShaderNodeMix')
            mm.data_type = 'RGBA'
            mm.blend_type = 'MULTIPLY'
            mm.inputs['Factor'].default_value = 1.0
            # the Mix node has float, vector and colour sockets that share the names A/B/Result: pick the colour ones
            a_, b_ = [s for s in mm.inputs if s.type == 'RGBA'][:2]
            L.new(col, a_)
            b_.default_value = (*color_mult, 1)
            col = [s for s in mm.outputs if s.type == 'RGBA'][0]
        L.new(col, bs.inputs['Base Color'])
    r = maps.get('Rough')
    if r:
        rt = img(r, True)
        ma = N.new('ShaderNodeMath')
        ma.operation = 'MULTIPLY_ADD'
        ma.use_clamp = True
        ma.inputs[1].default_value = rough_mult
        ma.inputs[2].default_value = rough_add
        L.new(rt.outputs['Color'], ma.inputs[0])
        L.new(ma.outputs['Value'], bs.inputs['Roughness'])
    elif 'arm' in maps:
        a = img(maps['arm'], True)
        sp = N.new('ShaderNodeSeparateColor')
        L.new(a.outputs['Color'], sp.inputs['Color'])
        ma = N.new('ShaderNodeMath')
        ma.operation = 'MULTIPLY_ADD'
        ma.use_clamp = True
        ma.inputs[1].default_value = rough_mult
        ma.inputs[2].default_value = rough_add
        L.new(sp.outputs['Green'], ma.inputs[0])
        L.new(ma.outputs['Value'], bs.inputs['Roughness'])
    if metal is not None:
        bs.inputs['Metallic'].default_value = metal
    elif 'Metal' in maps:
        L.new(img(maps['Metal'], True).outputs['Color'], bs.inputs['Metallic'])
    if 'nor_gl' in maps and bump > 0:
        n = img(maps['nor_gl'], True)
        nm = N.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = bump
        L.new(n.outputs['Color'], nm.inputs['Color'])
        L.new(nm.outputs['Normal'], bs.inputs['Normal'])
        if coat:
            L.new(nm.outputs['Normal'], bs.inputs['Coat Normal']) if False else None
    if coat:
        bs.inputs['Coat Weight'].default_value = coat
        bs.inputs['Coat Roughness'].default_value = coat_rough
    if sheen:
        bs.inputs['Sheen Weight'].default_value = sheen
    if disp and 'Displacement' in maps:
        dt = img(maps['Displacement'], True)
        dn = N.new('ShaderNodeDisplacement')
        dn.inputs['Scale'].default_value = disp
        dn.inputs['Midlevel'].default_value = 0.5
        L.new(dt.outputs['Color'], dn.inputs['Height'])
        L.new(dn.outputs['Displacement'], N['Material Output'].inputs['Displacement'])
        m.displacement_method = 'BOTH'
    return m


def principled(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def emission(name, color=(1, 1, 1), strength=10.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N = m.node_tree.nodes
    N.remove(N['Principled BSDF'])
    e = N.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    m.node_tree.links.new(e.outputs['Emission'], N['Material Output'].inputs['Surface'])
    return m


def glass(name, ior=1.5, rough=0.0, tint=(1, 1, 1)):
    return principled(name, color=tint, rough=rough, **{'Transmission Weight': 1.0, 'IOR': ior})


def camera(sc, loc, target, lens=50, fstop=2.8, focus=None, sensor=36, shift=(0, 0)):
    import mathutils
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.clip_start = 0.01
    cd.clip_end = 20000
    cd.sensor_width = sensor
    cd.shift_x, cd.shift_y = shift
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cd.dof.use_dof = fstop is not None
    if fstop:
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus if focus else d.length
        cd.dof.aperture_blades = 9
    sc.camera = cam
    return cam


def light(sc, kind, loc, target=None, energy=100, color=(1, 1, 1), size=0.5, spot=None, blend=0.15, shape='SQUARE',
          size_y=None, name='light'):
    import mathutils
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == 'AREA':
        ld.shape = shape
        ld.size = size
        if size_y:
            ld.size_y = size_y
    elif kind in ('POINT', 'SPOT'):
        ld.shadow_soft_size = size
    if kind == 'SPOT':
        ld.spot_size = spot or math.radians(40)
        ld.spot_blend = blend
    lo = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(lo)
    lo.location = loc
    if target is not None:
        d = mathutils.Vector(target) - mathutils.Vector(loc)
        lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return lo


def add(obj, mat=None, sc=None):
    (sc or bpy.context.scene).collection.objects.link(obj) if obj.name not in bpy.context.scene.objects else None
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    return obj


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


def render(sc, design, slot, quality=80, max_kb=None):
    """Renders to PNG under OUT, then writes the progressive JPG into the repo (skipped for --preview)."""
    os.makedirs(OUT, exist_ok=True)
    tag = f'{design}-{slot}' + ('-preview' if PREVIEW else '')
    png = os.path.join(OUT, tag + '.png')
    sc.render.filepath = png
    import time
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'RENDER {tag} {time.time() - t:.0f}s')
    with open(os.path.join(OUT, tag + '.assets.json'), 'w') as f:
        json.dump(sorted(set(USED)), f)
    if PREVIEW:
        return png
    return finish(png, design, slot, quality, max_kb)


# Per-slot JPG budgets (KB). The site preview inlines every photo of a design, so a design's photos together stay
# around 160-190 KB to keep Lighthouse mobile performance at 90+; q80 is the starting quality.
BUDGET = {('optic', 'hero'): 72, ('optic', 'heroPhone'): 50, ('optic', 'tray'): 45,
          ('freight', 'hero'): 54, ('freight', 'heroPhone'): 40, ('freight', 'yard'): 58,
          ('roastery', 'bag'): 74, ('roastery', 'roaster'): 110,
          ('beacon', 'hero'): 56, ('beacon', 'about'): 78}


def finish(png, design, slot, quality=80, max_kb=None):
    max_kb = max_kb or BUDGET.get((design, slot), 150)
    d = os.path.join(REPO_REAL, design)
    os.makedirs(d, exist_ok=True)
    jpg = os.path.join(d, f'{slot}.jpg')
    q = quality
    while True:
        subprocess.run(['convert', png, '-strip', '-colorspace', 'sRGB', '-depth', '8', '-sampling-factor', '4:2:0',
                        '-interlace', 'JPEG', '-quality', str(q), jpg], check=True)
        kb = os.path.getsize(jpg) / 1024
        if kb <= max_kb or q <= 55:
            break
        q -= 2
    print(f'JPG {jpg} q{q} {kb:.0f}KB')
    return jpg
