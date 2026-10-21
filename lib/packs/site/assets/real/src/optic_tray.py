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
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, TH / 2)); tray = bpy.context.object; tray.scale = (TW, TD, TH)
bpy.ops.object.transform_apply(scale=True)
bv = tray.modifiers.new('bev', 'BEVEL'); bv.width = 0.004; bv.segments = 4
tray.data.materials.append(lacquer)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, TH - 0.006)); cut = bpy.context.object; cut.scale = (TW - 0.03, TD - 0.03, 0.03)
bo = tray.modifiers.new('cut', 'BOOLEAN'); bo.object = cut; bo.operation = 'DIFFERENCE'; cut.hide_render = True
tray.modifiers.move(1, 0)
vel = C.texture('velour_velvet', '2k')
vel_m = C.pbr('velvet', vel, scale=1.0, hue_sat=(0.5, 0.0, 1.0), color_mult=(0.018, 0.018, 0.02), rough_mult=1.0, bump=0.6, sheen=0.5)
vel_m.node_tree.nodes['Principled BSDF'].inputs['Sheen Tint'].default_value = (0.6, 0.6, 0.62, 1)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.012)); bed = bpy.context.object; bed.scale = (TW - 0.031, TD - 0.031, 0.02)
bpy.ops.object.transform_apply(scale=True); C.uv_box(bed, 6.0)
bv = bed.modifiers.new('bev', 'BEVEL'); bv.width = 0.004; bv.segments = 3
bed.data.materials.append(vel_m)
BED_Z = 0.022

FINISHES = [('gold', (0.86, 0.66, 0.42), 1.0, 0.17), ('gunmetal', (0.22, 0.22, 0.24), 1.0, 0.26), ('silver', (0.9, 0.9, 0.92), 1.0, 0.13),
            ('rose', (0.9, 0.62, 0.52), 1.0, 0.2), ('matte_black', (0.025, 0.025, 0.027), 0.35, 0.45)]
lens_glass = C.glass('crown_glass', ior=1.52)
src = [o for o in C.model('round_spectacles', '2k') if o.type == 'MESH'][0]
SPOTS = [(-0.2, 0.08, 8), (0.0, 0.1, -6), (0.2, 0.075, 12), (-0.105, -0.085, -10), (0.105, -0.08, 5)]
for (x, y, rz), (fname, col, metal, rough) in zip(SPOTS, FINISHES):
    o = src.copy(); o.data = src.data.copy(); sc.collection.objects.link(o)
    for i, m in enumerate(o.data.materials):
        if 'glass' in m.name:
            o.data.materials[i] = lens_glass
        else:
            mm = m.copy(); mm.name = 'frame_' + fname
            b = mm.node_tree.nodes['Principled BSDF']
            for sock in ('Base Color', 'Metallic', 'Roughness', 'Alpha'):
                for l in list(b.inputs[sock].links): mm.node_tree.links.remove(l)
            b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal
            b.inputs['Roughness'].default_value = rough
            mm.surface_render_method = 'DITHERED'
            o.data.materials[i] = mm
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

cam = C.camera(sc, (float(E('CAMX', '0.08')), float(E('CAMY', '-0.66')), float(E('CAMZ', '0.3'))), (0.0, 0.05, 0.03), lens=float(E('LENS', '60')),
               fstop=float(E('FSTOP', '2.8')))
cam.data.dof.focus_distance = (Vector((0.0, -0.08, 0.03)) - cam.location).length

C.render(sc, 'optic', 'tray')
