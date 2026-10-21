# optic / tray: five pairs of round wire frames in different metal finishes, standing open in a charcoal velvet
# display tray on the black marble table, city lights out of focus behind. Frames: Poly Haven round_spectacles (CC0)
# with their finish swapped; velvet: Poly Haven velour_velvet (CC0), desaturated.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, mathutils
from mathutils import Vector

E = os.environ.get
W, H = 1500, 900
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '96')), exposure=float(E('EXPO', '0')))
C.world_color(sc, (0.002, 0.0022, 0.003))
rng = random.Random(9)

# table: black stone (same recipe as the hero, simplified)
stone = C.principled('black_stone', color=(0.012, 0.012, 0.013), rough=0.09, **{'Specular IOR Level': 0.55})
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.4, -0.02)); t = bpy.context.object; t.scale = (3, 3, 0.04); t.data.materials.append(stone)

# tray: black lacquer frame, velvet bed
lacquer = C.principled('black_lacquer', color=(0.01, 0.01, 0.011), rough=0.12, **{'Coat Weight': 1.0, 'Coat Roughness': 0.03})
TW, TD, TH = 0.66, 0.40, 0.035
# base slab and four bevelled rim bars (no boolean: a cut left a bright sliver on the front rim)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.004)); base = bpy.context.object; base.scale = (TW, TD, 0.008)
bv = base.modifiers.new('bev', 'BEVEL'); bv.width = 0.003; bv.segments = 3; base.data.materials.append(lacquer)
RW = 0.015
# the rim in a satin finish: in gloss its inner bevel mirrored the overhead strip as a bright broken sliver
rim_m = C.principled('satin_lacquer', color=(0.01, 0.01, 0.011), rough=0.4, **{'Coat Weight': 0.4, 'Coat Roughness': 0.28})
for (cx, cy, sx, sy) in ((0, -(TD - RW) / 2, TW, RW), (0, (TD - RW) / 2, TW, RW), (-(TW - RW) / 2, 0, RW, TD - 2 * RW), ((TW - RW) / 2, 0, RW, TD - 2 * RW)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, TH / 2)); r_ = bpy.context.object; r_.scale = (sx, sy, TH)
    bpy.ops.object.transform_apply(scale=True)
    bv = r_.modifiers.new('bev', 'BEVEL'); bv.width = 0.003; bv.segments = 4; bv.limit_method = 'ANGLE'
    C.smooth(r_); r_.data.materials.append(rim_m)
vel = C.texture('velour_velvet', '2k')
vel_m = C.pbr('velvet', vel, scale=1.0, hue_sat=(0.5, 0.0, 1.0), color_mult=(0.008, 0.008, 0.009), rough_mult=1.0, rough_add=0.3, bump=0.6,
              sheen=0.35, metal=0.0)
_b = vel_m.node_tree.nodes['Principled BSDF']
_b.inputs['Sheen Tint'].default_value = (0.16, 0.16, 0.17, 1)   # black pile: the sheen stays dark, no felt-beige
_b.inputs['Specular IOR Level'].default_value = 0.15
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.012)); bed = bpy.context.object; bed.scale = (TW - 2 * RW + 0.002, TD - 2 * RW + 0.002, 0.02)   # tucked into the walls: no light gap at the rim
bpy.ops.object.transform_apply(scale=True); C.uv_box(bed, 6.0)
bv = bed.modifiers.new('bev', 'BEVEL'); bv.width = 0.004; bv.segments = 3
bed.data.materials.append(vel_m)
BED_Z = 0.022

FINISHES = [('gold', (0.86, 0.66, 0.42), 1.0, 0.17, 0.0), ('tortoise', None, 0.0, 0.08, 0.0011), ('titanium', (0.56, 0.56, 0.58), 1.0, 0.34, -0.0002),
            ('rose', (0.9, 0.62, 0.52), 1.0, 0.2, 0.0), ('matte_black', (0.025, 0.025, 0.027), 0.35, 0.45, 0.0)]


def tortoise(name):
    """Acetate tortoiseshell: amber body with dark mottles from two noise layers, glossy and slightly translucent."""
    m = C.principled(name, color=(0.3, 0.12, 0.03), rough=0.08, **{'Coat Weight': 1.0, 'Coat Roughness': 0.03, 'Subsurface Weight': 0.3,
                                                                  'Subsurface Radius': (0.004, 0.002, 0.001), 'Subsurface Scale': 1.0})
    nt = m.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 180; n1.inputs['Detail'].default_value = 4; n1.inputs['Distortion'].default_value = 2.5
    L.new(tc.outputs['Object'], n1.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].position = 0.46; e[0].color = (0.006, 0.0025, 0.001, 1); e[1].position = 0.64; e[1].color = (0.2, 0.075, 0.014, 1)
    L.new(n1.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], b.inputs['Base Color']); L.new(ramp.outputs['Color'], b.inputs['Subsurface Radius'])
    return m


lens_glass = C.glass('crown_glass', ior=1.52)
src = [o for o in C.model('round_spectacles', '2k') if o.type == 'MESH'][0]
SPOTS = [(-0.17, 0.08, 8), (0.0, 0.1, -6), (0.165, 0.07, 12), (-0.1, -0.085, -10), (0.1, -0.08, 5)]
for (x, y, rz), (fname, col, metal, rough, fat) in zip(SPOTS, FINISHES):
    o = src.copy(); o.data = src.data.copy(); sc.collection.objects.link(o)
    for i, m in enumerate(o.data.materials):
        if 'glass' in m.name:
            o.data.materials[i] = lens_glass
        else:
            if fname == 'tortoise':
                o.data.materials[i] = tortoise('frame_tortoise'); continue
            mm = m.copy(); mm.name = 'frame_' + fname
            b = mm.node_tree.nodes['Principled BSDF']
            for sock in ('Base Color', 'Metallic', 'Roughness', 'Alpha'):
                for l in list(b.inputs[sock].links): mm.node_tree.links.remove(l)
            b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal
            b.inputs['Roughness'].default_value = rough
            mm.surface_render_method = 'DITHERED'
            o.data.materials[i] = mm
    if fat:   # acetate rims are chunkier, titanium wire thinner: push the surface along its normals
        d = o.modifiers.new('fat', 'DISPLACE'); d.strength = fat; d.mid_level = 0.0
    o.rotation_euler = (0, 0, math.radians(rz + rng.uniform(-3, 3)))
    o.location = (x, y, 0)
    bpy.context.view_layer.update()
    zmin = min((o.matrix_world @ v.co).z for v in o.data.vertices)
    o.location.z = BED_Z - zmin - 0.0015  # pressed a touch into the pile
    C.smooth(o)
bpy.data.objects.remove(src)

# far lights behind for depth (same city as the hero, much further out of focus)
C.bokeh_field((0, -0.75, 0.55), n=30, az=(-25, 25), el=(-14, -2), dist=(30, 200), strength=(0.3, 3), seed=3, rad=0.008)
# a window wall far behind so the stone doesn't reflect the void
# light: soft overhead strip (draws a line on every lens), warm lamp low left, cool rim from the window
C.light(sc, 'AREA', (0.0, -0.05, 0.75), target=(0, 0.02, 0), energy=float(E('TOP', '7')), color=C.kelvin(4200), size=0.9, size_y=0.12,
        shape='RECTANGLE', name='strip')
C.light(sc, 'AREA', (-0.7, -0.35, 0.3), target=(0, 0, 0.03), energy=float(E('LAMP', '14')), color=C.kelvin(2700), size=0.2, shape='DISK', name='lamp')
rim = C.light(sc, 'AREA', (0.4, 0.8, 0.25), target=(0, 0, 0.02), energy=6, color=C.kelvin(7000), size=0.6, name='rim')
rim.visible_glossy = False

cam = C.camera(sc, (float(E('CAMX', '0.08')), float(E('CAMY', '-0.66')), float(E('CAMZ', '0.3'))), (0.0, 0.05, 0.03), lens=float(E('LENS', '54')),
               fstop=float(E('FSTOP', '2.8')))
cam.data.dof.focus_distance = (Vector((0.0, -0.08, 0.03)) - cam.location).length

C.render(sc, 'optic', 'tray')
