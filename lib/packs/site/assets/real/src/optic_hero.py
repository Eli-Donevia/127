# optic / hero: round wire spectacles on a polished black marble table, a night skyline through the window behind,
# its lights refracted in the lenses and reflected in the stone. One warm practical, one cool cyan neon accent.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, mathutils

SLOT = os.environ.get('SLOT', 'hero')
W, H = {'hero': (1800, 1200), 'heroPhone': (1080, 1600)}[SLOT]
sc = C.reset()
C.setup(sc, W, H, samples=int(os.environ.get('SAMPLES', '96')), exposure=0.0)

# --- night city far below the window: procedural skyline plane (no people), dark world
C.world_color(sc, (0.002, 0.0022, 0.003))
# (no skyline plane: at this aperture its glow fogs the frame; the far lights alone read as the city)

# --- table: procedural Nero Marquina style marble, honed to a soft polish
def marble():
    m = bpy.data.materials.new('black_marble')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.9, 0.9, 0.9)
    mp.inputs['Rotation'].default_value[2] = 0.5
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    warp = N.new('ShaderNodeTexNoise'); warp.inputs['Scale'].default_value = 1.4; warp.inputs['Detail'].default_value = 8
    warp.inputs['Distortion'].default_value = 0.6
    L.new(mp.outputs['Vector'], warp.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'VECTOR'; mix.inputs['Factor'].default_value = 0.55
    L.new(mp.outputs['Vector'], mix.inputs['A']); L.new(warp.outputs['Color'], mix.inputs['B'])
    wave = N.new('ShaderNodeTexWave'); wave.wave_profile = 'SIN'; wave.inputs['Scale'].default_value = 1.1
    wave.inputs['Distortion'].default_value = 9; wave.inputs['Detail'].default_value = 10; wave.inputs['Detail Scale'].default_value = 2.5
    L.new(mix.outputs['Result'], wave.inputs['Vector'])
    vr = N.new('ShaderNodeValToRGB')  # thin pale veins
    e = vr.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.035, 0.035, 0.034, 1)
    e[1].position, e[1].color = 0.008, (0.012, 0.012, 0.013, 1)
    L.new(wave.outputs['Fac'], vr.inputs['Fac'])
    fine = N.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 60; fine.inputs['Detail'].default_value = 6
    L.new(mp.outputs['Vector'], fine.inputs['Vector'])
    fr = N.new('ShaderNodeValToRGB')
    fr.color_ramp.elements[0].position = 0.35; fr.color_ramp.elements[0].color = (0.006, 0.006, 0.007, 1)
    fr.color_ramp.elements[1].position = 0.75; fr.color_ramp.elements[1].color = (0.02, 0.02, 0.021, 1)
    L.new(fine.outputs['Fac'], fr.inputs['Fac'])
    lt = N.new('ShaderNodeMix'); lt.data_type = 'RGBA'; lt.blend_type = 'LIGHTEN'; lt.inputs['Factor'].default_value = 1
    L.new(fr.outputs['Color'], lt.inputs['A']); L.new(vr.outputs['Color'], lt.inputs['B'])
    L.new(lt.outputs['Result'], b.inputs['Base Color'])
    # polish with faint wipe marks
    rn = N.new('ShaderNodeTexNoise'); rn.inputs['Scale'].default_value = 7; rn.inputs['Detail'].default_value = 4
    sm = N.new('ShaderNodeMapping'); sm.inputs['Scale'].default_value = (1, 9, 1)
    L.new(tc.outputs['Object'], sm.inputs['Vector']); L.new(sm.outputs['Vector'], rn.inputs['Vector'])
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.035; rr.inputs['To Max'].default_value = 0.08
    L.new(rn.outputs['Fac'], rr.inputs['Value']); L.new(rr.outputs['Result'], b.inputs['Roughness'])
    bn = N.new('ShaderNodeBump'); bn.inputs['Strength'].default_value = 0.03
    L.new(fine.outputs['Fac'], bn.inputs['Height']); L.new(bn.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Specular IOR Level'].default_value = 0.55
    return m

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.6, -0.02))
table = bpy.context.object
table.scale = (2.4, 2.4, 0.04)
bpy.ops.object.transform_apply(scale=True)
bv = table.modifiers.new('bev', 'BEVEL'); bv.width = 0.004; bv.segments = 4
table.data.materials.append(marble())

# --- spectacles: Poly Haven round_spectacles (CC0), lenses swapped for real glass
objs = C.model('round_spectacles', '2k')
spec = [o for o in objs if o.type == 'MESH'][0]
spec.rotation_euler = (0, 0, math.radians(float(os.environ.get('SPIN', '-24'))))
spec.location = (0.0, 0.0, 0.0)
bpy.context.view_layer.update()
zmin = min((spec.matrix_world @ v.co).z for v in spec.data.vertices)
spec.location.z -= zmin
lens_glass = C.glass('crown_glass', ior=1.52, rough=0.0)
lens_glass.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value = 0.0
for i, m in enumerate(spec.data.materials):
    if 'glass' in m.name:
        spec.data.materials[i] = lens_glass
    else:  # polished gold wire: keep the model's normal map, swap the finish
        m.surface_render_method = 'DITHERED'
        b = m.node_tree.nodes['Principled BSDF']
        for sock in ('Base Color', 'Metallic', 'Roughness', 'Alpha'):
            for l in list(b.inputs[sock].links): m.node_tree.links.remove(l)
        b.inputs['Base Color'].default_value = (0.86, 0.66, 0.42, 1)
        b.inputs['Metallic'].default_value = 1.0
        b.inputs['Roughness'].default_value = 0.17
C.smooth(spec)

# --- window: tall glass wall with thin black mullions, 1.6 m behind
win_glass = bpy.data.materials.new('window'); win_glass.use_nodes = True
_n = win_glass.node_tree.nodes; _n.remove(_n['Principled BSDF'])
win_glass.node_tree.links.new(_n.new('ShaderNodeBsdfTransparent').outputs[0], _n['Material Output'].inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 1.9, 1.2), rotation=(math.radians(90), 0, 0))
pane = bpy.context.object; pane.scale = (8, 3, 1); pane.data.materials.append(win_glass)
pane.visible_shadow = False
mull = C.principled('mullion', color=(0.01, 0.01, 0.01), rough=0.4, metal=0.6)
for x in (-1.25, 0.55, 2.35):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 1.88, 1.2)); o = bpy.context.object
    o.scale = (0.06, 0.06, 3.2); o.data.materials.append(mull)
# dark room around (so the table reflects black, not the sky everywhere)
room = C.principled('room', color=(0.02, 0.018, 0.016), rough=0.8)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -2.0, 1.2)); o = bpy.context.object; o.scale = (8, 0.1, 3); o.data.materials.append(room)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 2.6)); o = bpy.context.object; o.scale = (8, 8, 0.1); o.data.materials.append(room)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-3.2, 0, 1.2)); o = bpy.context.object; o.scale = (0.1, 8, 3); o.data.materials.append(room)
bpy.ops.mesh.primitive_cube_add(size=1, location=(3.2, 0, 1.2)); o = bpy.context.object; o.scale = (0.1, 8, 3); o.data.materials.append(room)

# --- cool cyan neon tube on the left wall, far back, out of focus (accent only)
bpy.ops.mesh.primitive_cylinder_add(radius=0.01, depth=1.2, location=(0.8, 1.7, 0.6), rotation=(0, 0, 0))
neon = bpy.context.object
neon.data.materials.append(C.emission('neon_cyan', (0.25, 0.85, 1.0), float(os.environ.get('NEON', '1.6' if SLOT == 'hero' else '0.3'))))

# --- dinner table behind, out of focus: a wine glass and a candle
def lathe(name, prof, mat, loc, thick=0.0012):
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    for a, b in zip(vs, vs[1:]): bm.edges.new((a, b))
    bm.to_mesh(me); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.location = loc
    sw = o.modifiers.new('screw', 'SCREW'); sw.steps = 96; sw.render_steps = 96; sw.use_merge_vertices = True
    if thick:
        so = o.modifiers.new('solid', 'SOLIDIFY'); so.thickness = thick
    o.modifiers.new('sub', 'SUBSURF').levels = 2
    o.data.materials.append(mat); C.smooth(o)
    return o
wine = [(0.0, 0.0), (0.038, 0.0), (0.036, 0.002), (0.006, 0.006), (0.004, 0.02), (0.0035, 0.09), (0.008, 0.1),
        (0.03, 0.115), (0.044, 0.14), (0.046, 0.17), (0.04, 0.2), (0.034, 0.215)]
lathe('wineglass', wine, C.glass('wine_glass', ior=1.5), (-0.42, 0.3, 0.0))
lathe('wineglass2', wine, C.glass('wine_glass2', ior=1.5), (0.42, 0.95, 0.0))
wax = C.principled('wax', color=(0.9, 0.86, 0.78), rough=0.45, **{'Subsurface Weight': 0.8, 'Subsurface Radius': (0.05, 0.03, 0.02)})
VX, VY = -0.2, 0.55
lathe('votive', [(0.0, 0.0), (0.032, 0.0), (0.033, 0.003), (0.034, 0.07), (0.0315, 0.07), (0.0305, 0.006), (0.0, 0.005)],
      C.glass('votive_glass', ior=1.5, tint=(0.95, 0.93, 0.9)), (VX, VY, 0.0), thick=0)
lathe('tealight', [(0.0, 0.0), (0.019, 0.0), (0.019, 0.016), (0.0, 0.016)], wax, (VX, VY, 0.006), thick=0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(VX, VY, 0.036)); fl = bpy.context.object
fl.scale = (0.0035, 0.0035, 0.011); fl.data.materials.append(C.emission('flame', (1.0, 0.6, 0.24), 50)); fl.visible_shadow = False
C.light(sc, 'POINT', (VX, VY, 0.04), energy=1.2, color=C.kelvin(1850), size=0.006, name='candle_light')

# --- warm practical: a small shaded lamp off frame left, low over the table
C.light(sc, 'AREA', (-0.55, -0.15, 0.42), target=(0.0, 0.05, 0.0), energy=22, color=C.kelvin(2700), size=0.15,
        shape='DISK', name='lamp')
# soft cool rim from the window side, very low
rim = C.light(sc, 'AREA', (0.35, 0.9, 0.3), target=(0, 0, 0.02), energy=2.5, color=(0.75, 0.85, 1.0), size=0.3, name='rim')
rim.visible_glossy = False
rim.visible_transmission = False
# a strip reflection to draw the frame's shape on the stone
strip = C.light(sc, 'AREA', (0.05, -0.2, 0.5), target=(0, 0, 0), energy=5, color=C.kelvin(3400), size=0.7, size_y=0.06,
        shape='RECTANGLE', name='strip')
strip.visible_transmission = False



C.bokeh_field((-0.12, -0.74, 0.13), n=int(os.environ.get('NB', '34')), el=(-5.5, 3.5), strength=(0.3, 4), seed=7, rad=0.008)
C.bokeh_field((-0.12, -0.74, 0.13), n=40, el=(-6, 1.0), dist=(6, 40), strength=(0.1, 0.8), seed=11, rad=0.004)
if SLOT == 'hero':
    cam = C.camera(sc, (-0.12, -0.74, 0.13), (-0.035, 0.06, 0.055), lens=85, fstop=2.8)
else:  # portrait: the frames in the upper middle (the phone headline covers the lower half), the city's lights above
    cam = C.camera(sc, (-0.2, -0.6, 0.12), (0.01, 0.05, 0.085), lens=85, fstop=2.8)
cam.data.dof.focus_distance = (mathutils.Vector((0, 0.0, 0.03)) - cam.location).length
cam.data.shift_y = 0.0 if SLOT == 'hero' else float(os.environ.get('SHY', '-0.34'))   # same lens, frame slid down

C.render(sc, 'optic', SLOT)
